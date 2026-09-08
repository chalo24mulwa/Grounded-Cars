import type { UserRole } from "@prisma/client";

// Single place that maps a role to its "home" page after login / when
// already authenticated and visiting an auth page. Used by loginAction,
// registerAction, and the auth pages' redirect-if-already-signed-in checks
// — one definition so they can't drift out of sync with each other.
export function roleDestination(role: UserRole): string {
  if (role === "ADMIN") return "/admin";
  if (role === "SELLER" || role === "MODERATOR") return "/dashboard";
  return "/account";
}

// A callback URL is only ever trusted if it's a same-origin relative path —
// "/dashboard/featured" is fine, "https://evil.com" or "//evil.com" (still
// a different host — protocol-relative) is not. Anything untrusted or
// malformed just falls back to null so the caller uses its own default
// (roleDestination) instead — a bad callbackUrl should never block sign-in.
export function safeCallbackUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
