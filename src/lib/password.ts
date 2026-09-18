import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

// ----------------------------------------------------------------------------
// Password hashing. New hashes use scrypt from Node's own crypto module;
// hashes created before this module existed are bcrypt ($2a$/$2b$/$2y$) and
// still verify — they are transparently upgraded to scrypt the next time that
// user signs in (see `needsRehash`), so nobody is ever forced to reset their
// password.
//
// Why the switch: bcryptjs is a pure-JavaScript bcrypt. At the cost factor
// this app used (12) one comparison takes ~0.8s on a fast desktop and several
// seconds on shared hosting — and, being plain JS, it runs on the one thread
// that serves every request, freezing the whole site while it works. scrypt
// runs natively in Node's thread pool (the event loop stays free) and is ~3x
// faster at N=2^15, r=8, p=1 — the standard recommendation for interactive
// logins — while being memory-hard (32 MiB per hash), which makes
// GPU/ASIC cracking of a leaked hash considerably more expensive than bcrypt.
// ----------------------------------------------------------------------------

const scryptAsync = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

const PARAMS = { N: 32768, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
// Refuse to run scrypt with cost parameters far beyond ours if a stored hash
// were ever malformed/tampered with — it would otherwise be a memory/CPU bomb.
const MAX_ACCEPTED_N = 2 ** 17;

// scrypt needs ~128*N*r bytes; Node's default limit (32 MiB) is exactly our
// own requirement, so leave explicit headroom.
function maxMemFor(N: number, r: number): number {
  return 256 * N * r;
}

/** Hashes a new password. Output: `scrypt$N$r$p$<salt b64>$<key b64>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = await scryptAsync(password, salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: maxMemFor(PARAMS.N, PARAMS.r),
  });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export type PasswordCheck = {
  valid: boolean;
  /** True when the password is correct but the stored hash is in an older
   * format/strength — the caller should save a fresh hashPassword() result. */
  needsRehash: boolean;
};

const INVALID: PasswordCheck = { valid: false, needsRehash: false };

/** Verifies a password against either a scrypt hash or a legacy bcrypt one. */
export async function verifyPassword(password: string, stored: string): Promise<PasswordCheck> {
  try {
    if (stored.startsWith("scrypt$")) {
      const [, nStr, rStr, pStr, saltB64, keyB64] = stored.split("$");
      const N = Number(nStr);
      const r = Number(rStr);
      const p = Number(pStr);
      if (!saltB64 || !keyB64) return INVALID;
      if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return INVALID;
      if (N < 2 || N > MAX_ACCEPTED_N || r < 1 || r > 16 || p < 1 || p > 16) return INVALID;

      const expected = Buffer.from(keyB64, "base64");
      if (expected.length === 0) return INVALID;
      const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, {
        N,
        r,
        p,
        maxmem: maxMemFor(N, r),
      });
      const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
      const current = N === PARAMS.N && r === PARAMS.r && p === PARAMS.p;
      return { valid, needsRehash: valid && !current };
    }

    // Anything else is treated as a legacy bcrypt hash.
    const valid = await bcrypt.compare(password, stored);
    return { valid, needsRehash: valid };
  } catch {
    return INVALID;
  }
}
