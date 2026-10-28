import "server-only";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mobileSessionContext } from "@/server/authorization/mobile-session-context";
import type { UserRole } from "@prisma/client";

// ----------------------------------------------------------------------------
// Centralized authorization. Every protected server action / route handler
// should go through these helpers rather than re-implementing checks inline.
// This is the single place that answers:
//   1. Is the user authenticated?
//   2. Does the user have the right role?
//   3. Does the resource actually belong to them?
//
// Critically: identity always comes from the server-side session (`auth()`),
// never from a client-supplied userId/sellerId in the request body. Any
// server action that accepts a `sellerId` parameter from the client for
// authorization purposes is a bug.
// ----------------------------------------------------------------------------

export class AuthorizationError extends Error {
  constructor(message = "You are not authorized to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

// A subclass of AuthorizationError (not a new top-level error type) so that
// every existing toUserSafeError() across the app — which already special-
// cases `error instanceof AuthorizationError` and shows `error.message` —
// automatically renders this correctly with zero changes to those files.
export class AccountSuspendedError extends AuthorizationError {
  constructor() {
    super("Your account is currently suspended. Contact support if you believe this is a mistake.");
    this.name = "AccountSuspendedError";
  }
}

// React's cache() memoizes per request, so one request that goes through
// several authorization helpers (e.g. an approval action checks the role, then
// the listing service checks it again) pays for this lookup once instead of
// once per helper. It never carries over between requests — each new request
// still re-reads the live status, so suspension still takes effect immediately.
const getAccountStatus = cache((userId: string) =>
  prisma.user.findUnique({ where: { id: userId }, select: { status: true } })
);

/**
 * Returns the current session's user, or throws if not authenticated.
 *
 * Also re-verifies the account's live status on every call — the JWT is
 * stateless and minted at login, so without this a still-valid session
 * token for an account suspended *during* that session would keep working
 * for every protected action until the token naturally expired. Login
 * itself already blocks non-ACTIVE accounts (src/lib/auth.ts's authorize());
 * this is specifically what makes "suspended users cannot access
 * prohibited features" true for an already-logged-in user, not just a
 * future login attempt.
 *
 * This runs on every protected server action/service call in the app
 * (everything goes through requireAuth or requireRole, which calls this) —
 * one extra indexed lookup by primary key per call, a deliberate tradeoff
 * for real-time suspension enforcement.
 *
 * Mobile requests carry a Bearer token instead of the httpOnly session
 * cookie auth() reads, so they can't resolve a session through auth() at
 * all. withMobileAuth (src/server/mobile/with-mobile-auth.ts) verifies that
 * token and runs the handler inside mobileSessionContext.run(user, ...) —
 * when present, that identity is used instead of calling auth(). Every
 * existing web request never enters that AsyncLocalStorage, so getStore()
 * is undefined and this falls through to auth() exactly as before; the
 * live-status re-check below still runs either way.
 */
export async function requireAuth() {
  const mobileUser = mobileSessionContext.getStore();
  const sessionUser = mobileUser ?? (await auth())?.user;
  if (!sessionUser) {
    throw new AuthenticationError();
  }

  const dbUser = await getAccountStatus(sessionUser.id);
  if (!dbUser || dbUser.status !== "ACTIVE") {
    throw new AccountSuspendedError();
  }

  return sessionUser;
}

/** Requires authentication AND that the user holds one of the given roles. */
export async function requireRole(...allowedRoles: UserRole[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(
      `This action requires one of the following roles: ${allowedRoles.join(", ")}.`
    );
  }
  return user;
}

/**
 * Verifies the current authenticated user owns the given car listing.
 * Admins bypass ownership (they're authorized separately, via role).
 *
 * This performs a fresh DB lookup by listingId — it never trusts a
 * `sellerId` passed in from the client, precisely so a manipulated request
 * body or URL param can't be used to edit someone else's listing.
 */
export async function requireListingOwnership(listingId: string) {
  const user = await requireAuth();

  if (user.role === "ADMIN") {
    const listing = await prisma.carListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new AuthorizationError("Listing not found.");
    return { user, listing };
  }

  const listing = await prisma.carListing.findUnique({ where: { id: listingId } });

  if (!listing) {
    throw new AuthorizationError("Listing not found.");
  }

  if (listing.sellerId !== user.id) {
    throw new AuthorizationError("You do not own this listing.");
  }

  return { user, listing };
}

/**
 * Narrower cousin of requireListingOwnership, used ONLY for the
 * approve/reject moderation action (see changeListingStatus's
 * accessMode param in listing-service.ts). ADMIN and MODERATOR both bypass
 * ownership here — but this is deliberately NOT the same bypass
 * requireListingOwnership grants ADMIN: that one also backs
 * updateListing/addListingImage/etc, so reusing it here would let MODERATOR
 * edit another seller's listing content, not just review its status. A
 * MODERATOR's access is scoped to this one action by design.
 */
export async function requireListingModerationAccess(listingId: string) {
  // Both lookups at once (one database wait instead of two). The role check
  // still decides: if it throws, the listing result is simply discarded.
  const [user, listing] = await Promise.all([
    requireRole("ADMIN", "MODERATOR"),
    prisma.carListing.findUnique({ where: { id: listingId } }),
  ]);
  if (!listing) {
    throw new AuthorizationError("Listing not found.");
  }

  return { user, listing };
}
