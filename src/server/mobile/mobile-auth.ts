import "server-only";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { UserRole } from "@prisma/client";
import type { MobileSessionUser } from "@/server/authorization/mobile-session-context";

// ----------------------------------------------------------------------------
// Mobile apps have no browser cookie jar, so they can't hold the httpOnly
// session Auth.js issues the website (see src/lib/auth.ts). This is the
// parallel, additive token exchange for them: login mints a short-lived JWT
// access token (verified per-request, never stored) plus a long-lived
// opaque refresh token (only its SHA-256 hash is ever persisted, in the
// MobileRefreshToken table — same at-rest convention as PasswordResetToken).
//
// Deliberately a SEPARATE secret (MOBILE_AUTH_SECRET) from AUTH_SECRET —
// compromising one surface never compromises the other. Same "not
// configured yet fails closed, never falls back to an insecure default"
// posture as src/lib/mpesa.ts's isMpesaConfigured().
// ----------------------------------------------------------------------------

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_TOKEN_BYTES = 32;

export class MobileAuthNotConfiguredError extends Error {
  constructor() {
    super("Mobile sign-in isn't set up yet. Please check back soon.");
    this.name = "MobileAuthNotConfiguredError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Incorrect email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super("This session has expired. Please log in again.");
    this.name = "InvalidRefreshTokenError";
  }
}

export function isMobileAuthConfigured(): boolean {
  return Boolean(process.env.MOBILE_AUTH_SECRET);
}

function getSecretKey(): Uint8Array {
  if (!isMobileAuthConfigured()) throw new MobileAuthNotConfiguredError();
  return new TextEncoder().encode(process.env.MOBILE_AUTH_SECRET!);
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export type MobileAuthTokens = {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires, so the client knows when to refresh. */
  expiresIn: number;
};

async function mintAccessToken(user: MobileSessionUser): Promise<string> {
  return new SignJWT({ role: user.role, email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecretKey());
}

async function mintRefreshToken(userId: string, deviceInfo?: string): Promise<string> {
  const rawToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  await prisma.mobileRefreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      deviceInfo,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return rawToken;
}

async function mintTokenPair(user: MobileSessionUser, deviceInfo?: string): Promise<MobileAuthTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    mintAccessToken(user),
    mintRefreshToken(user.id, deviceInfo),
  ]);
  return { accessToken, refreshToken, expiresIn: 15 * 60 };
}

/** Verifies a Bearer access token. Returns null on any failure (expired,
 * malformed, wrong signature) rather than throwing — callers (withMobileAuth)
 * treat every failure mode identically, as an unauthenticated request. */
export async function verifyMobileAccessToken(token: string): Promise<MobileSessionUser | null> {
  if (!isMobileAuthConfigured()) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string") return null;
    return {
      id: payload.sub,
      role: payload.role as UserRole,
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies email+password exactly as src/lib/auth.ts's Credentials
 * provider does (same hash check, same status==ACTIVE gate, same
 * best-effort legacy-bcrypt-to-scrypt upgrade), then mints a fresh token
 * pair. This duplicates that one check rather than importing from
 * src/lib/auth.ts on purpose — that file wires up NextAuth's own request
 * lifecycle (cookies, redirects) and isn't meant to be called directly.
 */
export async function loginWithCredentials(
  email: string,
  password: string,
  deviceInfo?: string
): Promise<MobileAuthTokens> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw new InvalidCredentialsError();
  if (user.status !== "ACTIVE") throw new InvalidCredentialsError();

  const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new InvalidCredentialsError();

  if (needsRehash) {
    void hashPassword(password)
      .then((passwordHash) => prisma.user.update({ where: { id: user.id }, data: { passwordHash } }))
      .catch((error) => console.error("Failed to upgrade password hash:", error));
  }

  return mintTokenPair({ id: user.id, role: user.role, email: user.email, name: user.name }, deviceInfo);
}

/**
 * Rotates a refresh token: the presented one is revoked and a new pair is
 * minted, regardless of outcome past this point — so a refresh token can
 * only ever be used once, and a stolen-then-reused one is detectable (the
 * legitimate client's next refresh will fail, a sign the token was reused).
 * Re-checks live User.status, same real-time suspension guarantee
 * requireAuth() gives the website.
 */
export async function refreshMobileSession(rawToken: string): Promise<MobileAuthTokens> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash } });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new InvalidRefreshTokenError();
  }

  await prisma.mobileRefreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || user.status !== "ACTIVE") throw new InvalidRefreshTokenError();

  return mintTokenPair(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    record.deviceInfo ?? undefined
  );
}

/** Logout: revokes the one refresh token presented. Never throws on an
 * already-invalid/unknown token — logging out is always a success from the
 * client's point of view. */
export async function revokeMobileRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.mobileRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
