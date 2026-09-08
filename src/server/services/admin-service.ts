import "server-only";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, AuthorizationError } from "@/server/authorization/ownership";
import { recordAuditLog } from "@/server/services/audit-service";
import { notify } from "@/server/services/notification-service";
import { createModeratorSchema, type CreateModeratorInput } from "@/server/validation/moderator-schema";
import type { UserRole, UserStatus, ListingStatus } from "@prisma/client";

const BCRYPT_ROUNDS = 12;

/**
 * Marketplace summary metrics for the admin dashboard. Every count here is
 * a single indexed COUNT/aggregate query (status, role — both indexed
 * columns), run in parallel — this stays cheap regardless of how many
 * users/listings exist, unlike scanning full tables client-side ever would.
 */
export async function getAdminOverview() {
  await requireRole("ADMIN");

  const now = new Date();

  const [
    totalUsers,
    totalSellers,
    totalBuyers,
    totalListings,
    activeListings,
    pendingListings,
    soldListings,
    featuredActiveListings,
    recentRegistrations,
    recentListings,
    activeCsrInitiatives,
    csrTotalRaised,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "SELLER" } }),
    prisma.user.count({ where: { role: "BUYER" } }),
    prisma.carListing.count(),
    prisma.carListing.count({ where: { status: "ACTIVE" } }),
    prisma.carListing.count({ where: { status: "PENDING" } }),
    prisma.carListing.count({ where: { status: "SOLD" } }),
    // "Featured active" = distinct listings with a currently-ACTIVE,
    // unexpired subscription AND the listing itself still ACTIVE — same
    // live definition used everywhere else (featured-service.ts), not a
    // separate/looser admin-only count.
    prisma.featuredSubscription
      .findMany({
        where: { status: "ACTIVE", expiresAt: { gt: now }, listing: { status: "ACTIVE" } },
        select: { listingId: true },
        distinct: ["listingId"],
      })
      .then((rows) => rows.length),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.carListing.findMany({
      select: { id: true, title: true, slug: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.csrInitiative.count({ where: { published: true, status: "ACTIVE" } }),
    prisma.csrInitiative.aggregate({ _sum: { amountRaised: true } }),
  ]);

  return {
    totalUsers,
    totalSellers,
    totalBuyers,
    totalListings,
    activeListings,
    pendingListings,
    soldListings,
    featuredActiveListings,
    recentRegistrations,
    recentListings,
    activeCsrInitiatives,
    csrTotalRaised: Number(csrTotalRaised._sum.amountRaised ?? 0),
  };
}

/** Listings awaiting approval (PENDING → ACTIVE requires ADMIN or
 * MODERATOR — see listing-status.ts). Read-only; approve/reject go through
 * approveListing()/rejectListing() in listing-service.ts, which is the only
 * module allowed to write CarListing rows. */
export async function getPendingListingsForModeration() {
  await requireRole("ADMIN", "MODERATOR");

  return prisma.carListing.findMany({
    where: { status: "PENDING" },
    include: {
      images: { orderBy: { displayOrder: "asc" }, take: 1 },
      seller: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: "asc" }, // oldest submission first
  });
}

const ADMIN_PAGE_SIZE = 20;

/** All listings, any status, for the admin listing browser (moderation of
 * already-ACTIVE listings — e.g. archiving something inappropriate that
 * already passed initial review — lives here, distinct from the
 * PENDING-only approval queue above). */
export async function getAllListingsForAdmin({
  status,
  page = 1,
}: {
  status?: ListingStatus;
  page?: number;
} = {}) {
  await requireRole("ADMIN");

  const safePage = Math.max(1, page);
  const where = status ? { status } : {};

  const [listings, totalCount] = await Promise.all([
    prisma.carListing.findMany({
      where,
      include: {
        images: { orderBy: { displayOrder: "asc" }, take: 1 },
        seller: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (safePage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.carListing.count({ where }),
  ]);

  return {
    listings,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE)),
    page: safePage,
  };
}

/** Paginated, filterable user list for admin — never returns passwordHash
 * (select is explicit, not a blanket findMany). */
export async function getUsersForAdmin({
  role,
  status,
  q,
  page = 1,
}: {
  role?: UserRole;
  status?: UserStatus;
  q?: string;
  page?: number;
} = {}) {
  await requireRole("ADMIN");

  const safePage = Math.max(1, page);
  const where = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { listings: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE)),
    page: safePage,
  };
}

/**
 * Read-only seller directory for the MODERATOR dashboard — name, email,
 * phone, and listing count only. Deliberately has no status field and no
 * way to change one: (de)activating an account stays an ADMIN-only action
 * (setUserStatus below); this function never exposes a path to it.
 */
export async function getSellersForModerator() {
  await requireRole("ADMIN", "MODERATOR");

  return prisma.user.findMany({
    where: { role: "SELLER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      _count: { select: { listings: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export class DuplicateModeratorEmailError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "DuplicateModeratorEmailError";
  }
}

export class ModeratorNotFoundError extends Error {
  constructor() {
    super("That moderator account could not be found.");
    this.name = "ModeratorNotFoundError";
  }
}

export class ModeratorHasActivityError extends Error {
  constructor() {
    super(
      "This moderator has existing listings or activity, so the account can't be deleted. Deactivate it instead, or ask them to archive their listings first."
    );
    this.name = "ModeratorHasActivityError";
  }
}

/**
 * Admin-only: creates a new MODERATOR account directly. There is no
 * self-service or public path to this role anywhere else in the app (see
 * registerUser() in auth-service.ts, hardcoded to BUYER) — this is the only
 * way one gets created, matching the same "admin-created, never
 * self-serviceable" posture the codebase already documents for ADMIN.
 */
export async function createModeratorAccount(input: CreateModeratorInput) {
  const admin = await requireRole("ADMIN");
  const data = createModeratorSchema.parse(input);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new DuplicateModeratorEmailError();
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const moderator = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: "MODERATOR",
    },
    select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true },
  });

  await recordAuditLog(admin.id, "MODERATOR_CREATED", "User", moderator.id, {
    email: moderator.email,
  });

  return moderator;
}

/** Admin-only, read-only — backs the /admin/moderators list. Deliberately
 * selects nothing beyond what that page needs; deactivating stays a
 * setUserStatus() call (see UserStatusControl), never something this
 * function itself can do. */
export async function getModeratorsForAdmin() {
  await requireRole("ADMIN");

  return prisma.user.findMany({
    where: { role: "MODERATOR" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      _count: { select: { listings: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Admin-only hard delete — deliberately narrower than a general "delete any
 * user" action (no such thing exists elsewhere; see setUserStatus's own doc
 * comment on why destructive delete is avoided). Two guards keep this safe:
 *   1. Only ever targets role MODERATOR — never reachable for a
 *      buyer/seller/admin account, regardless of what id is passed in.
 *   2. Refuses to delete an account that owns listings, inquiries, payments,
 *      or featured subscriptions — those relations are onDelete: Restrict
 *      at the database level (schema.prisma), so this would otherwise fail
 *      with a raw constraint error; checking up front turns that into a
 *      clear message and keeps "deactivate is the general answer, delete is
 *      only for a clean/mistaken account" as the actual policy.
 * Everything else the account touches (sessions, favorites, notifications,
 * password reset tokens) cascades; anything it authored as an actor
 * (listing status history, coupons created, audit log entries) is
 * preserved with the reference set to null (onDelete: SetNull) rather than
 * deleted, so past moderation history doesn't disappear.
 */
export async function deleteModeratorAccount(targetUserId: string) {
  const admin = await requireRole("ADMIN");

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.role !== "MODERATOR") {
    throw new ModeratorNotFoundError();
  }

  const [listingCount, inquiryCount, paymentCount, subscriptionCount] = await Promise.all([
    prisma.carListing.count({ where: { sellerId: targetUserId } }),
    prisma.inquiry.count({ where: { sellerId: targetUserId } }),
    prisma.paymentTransaction.count({ where: { userId: targetUserId } }),
    prisma.featuredSubscription.count({ where: { userId: targetUserId } }),
  ]);
  if (listingCount > 0 || inquiryCount > 0 || paymentCount > 0 || subscriptionCount > 0) {
    throw new ModeratorHasActivityError();
  }

  await prisma.user.delete({ where: { id: targetUserId } });

  await recordAuditLog(admin.id, "MODERATOR_DELETED", "User", targetUserId, {
    email: target.email,
  });
}

/**
 * Changes a user's account status (ACTIVE/SUSPENDED/DEACTIVATED) — the only
 * "user management" action this phase implements, deliberately: no
 * destructive delete anywhere. Blocks an admin from changing their own
 * status (can't accidentally or maliciously lock themselves out), and
 * writes an audit log entry — this is exactly the "user suspended" example
 * the spec calls out by name.
 */
export async function setUserStatus(targetUserId: string, status: UserStatus, reason?: string) {
  const admin = await requireRole("ADMIN");

  if (targetUserId === admin.id) {
    throw new AuthorizationError("You cannot change your own account status.");
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new AuthorizationError("User not found.");
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { status },
    select: { id: true, name: true, email: true, status: true },
  });

  await recordAuditLog(admin.id, "USER_STATUS_CHANGED", "User", targetUserId, {
    from: target.status,
    to: status,
    targetEmail: target.email,
    reason,
  });

  // ACCOUNT_STATUS_CHANGED is a REQUIRED_TYPES notification (see
  // notification-service.ts) — it always sends regardless of the target
  // user's preference, since being told your own account was suspended is
  // exactly the "operationally/legally necessary" case the spec carves out.
  await notify({
    userId: targetUserId,
    type: "ACCOUNT_STATUS_CHANGED",
    vars: { status, reason: reason ?? "" },
    relatedEntityType: "User",
    relatedEntityId: targetUserId,
  });

  return updated;
}

/**
 * Starts an admin impersonation session — lets an admin act on behalf of a
 * user to perform their own functions directly (list a car for them, walk
 * them through the featured-plan checkout, edit their profile), exactly as
 * they'd do it themselves. This only validates and writes the audit trail;
 * the actual session JWT swap (updateSession) has to happen in the calling
 * server action — same split as becomeSeller()/becomeSellerAction().
 *
 * Deliberately blocked: impersonating another admin (no legitimate support
 * reason to, and it's the one direction that must never be possible — an
 * impersonated session's role becomes the target's, so allowing an ADMIN
 * target would hand out real admin access through this feature),
 * impersonating yourself, and impersonating a non-ACTIVE account (they
 * couldn't perform any action anyway — every write already goes through
 * requireAuth()'s live status check, so it would just fail immediately).
 */
export async function startImpersonation(targetUserId: string) {
  const admin = await requireRole("ADMIN");

  if (targetUserId === admin.id) {
    throw new AuthorizationError("You cannot impersonate your own account.");
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!target) {
    throw new AuthorizationError("User not found.");
  }
  if (target.role === "ADMIN") {
    throw new AuthorizationError("Admin accounts cannot be impersonated.");
  }
  if (target.status !== "ACTIVE") {
    throw new AuthorizationError("Only active accounts can be impersonated.");
  }

  await recordAuditLog(admin.id, "IMPERSONATION_START", "User", target.id, {
    targetEmail: target.email,
    targetRole: target.role,
  });

  return { admin, target };
}

/**
 * Ends an impersonation session, restoring the original admin's identity.
 * Reads the impersonator id straight off the live signed session (never a
 * client-supplied value) so this can only ever restore whoever actually
 * started the impersonation — never used to "become" a different admin.
 *
 * Deliberately does not require an ADMIN role itself: while impersonating,
 * the live session's role is the *target's* role (BUYER/SELLER), not
 * ADMIN, so requiring ADMIN here would make exiting impersonation
 * impossible. Exiting must always be reachable regardless of what the
 * impersonated account's role or status is.
 */
export async function endImpersonation() {
  const session = await auth();
  if (!session?.user || !session.impersonatorId) {
    throw new AuthorizationError("You are not currently impersonating a user.");
  }

  const impersonatedUserId = session.user.id;
  const admin = await prisma.user.findUnique({
    where: { id: session.impersonatorId },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!admin || admin.role !== "ADMIN" || admin.status !== "ACTIVE") {
    throw new AuthorizationError("Your admin session could not be restored. Please log in again.");
  }

  await recordAuditLog(admin.id, "IMPERSONATION_END", "User", impersonatedUserId, {});

  return { admin };
}
