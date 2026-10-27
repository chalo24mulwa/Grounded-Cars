// One-off maintenance script: resets (creates if missing, or fixes if
// present) the single ADMIN account to the email/password given via
// environment variables (never hardcoded here — this file is committed to
// git, so a literal credential in it would sit in history forever). Written
// as plain CommonJS JS (not .ts, and no tsx import) so it runs with a bare
// `node`, since ts-node/tsx are devDependencies that a production
// `npm ci --omit=dev`-style install wouldn't have available on the server.
//
// Password hashing matches src/lib/password.ts's scrypt format exactly
// (`scrypt$N$r$p$<salt b64>$<key b64>`, N=32768 r=8 p=1) — the same format
// every normal signup/password-reset produces — rather than a legacy bcrypt
// hash, so this account isn't singled out as the one to silently upgrade on
// next login.
//
// Run this ON THE SERVER (Hostinger's Node.js app terminal/SSH), from the
// project root, so it uses that environment's own already-configured
// DATABASE_URL — never paste a production connection string anywhere else:
//
//   ADMIN_EMAIL='<email>' ADMIN_PASSWORD='<password>' node scripts/reset-admin.js
//
// Safe to run more than once (idempotent) — it only ever touches this one
// user row by email, never any other user, listing, or table.
const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scryptAsync = promisify(crypto.scrypt);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables before running this script.");
  process.exit(1);
}

// Same parameters as hashPassword() in src/lib/password.ts.
const PARAMS = { N: 32768, r: 8, p: 1 };
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = await scryptAsync(password, salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: 256 * PARAMS.N * PARAMS.r,
  });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, role: "ADMIN", status: "ACTIVE" },
    create: {
      name: "Admin User",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Admin account ready: ${admin.email} (role: ${admin.role}, status: ${admin.status})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
