import "server-only";
import type { CouponScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/authorization/ownership";
import {
  createCouponSchema,
  updateCouponSchema,
  type CreateCouponInput,
  type UpdateCouponInput,
} from "@/server/validation/coupon-schema";

// ----------------------------------------------------------------------------
// Coupons — admin-managed discount codes for Featured Listings and the
// orderable Services. The ONLY module that writes to Coupon/
// CouponRedemption, same "one owning service per model" convention as
// every other feature in this app.
//
// Deliberately NOT imported by csr-service.ts or insurance-service.ts —
// that omission, not a runtime scope check, is what keeps coupons off CSR
// donations and Insurance purchases entirely (see the schema.prisma
// comment on CouponScope).
// ----------------------------------------------------------------------------

export class CouponNotFoundError extends Error {
  constructor() {
    super("That coupon code isn't valid.");
    this.name = "CouponNotFoundError";
  }
}

export class CouponUsageLimitExceededError extends Error {
  constructor() {
    super("You've already used this coupon the maximum number of times.");
    this.name = "CouponUsageLimitExceededError";
  }
}

export class DuplicateCouponCodeError extends Error {
  constructor(code: string) {
    super(`A coupon with the code "${code}" already exists.`);
    this.name = "DuplicateCouponCodeError";
  }
}

export class CouponNotFoundForAdminError extends Error {
  constructor() {
    super("This coupon could not be found.");
    this.name = "CouponNotFoundForAdminError";
  }
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function computeDiscountedAmount(amount: number, discountPercent: number): number {
  // M-Pesa STK push amounts are whole KES (initiateStkPush already rounds),
  // so round here too — the discount a customer previews is exactly what
  // they're actually charged, never off by a few cents from rounding twice.
  const discounted = amount * (1 - discountPercent / 100);
  return Math.max(0, Math.round(discounted));
}

/** Looks up an active (non-archived) coupon by code — the one shared
 * lookup every other function in this module builds on. */
async function resolveCoupon(rawCode: string) {
  const code = normalizeCode(rawCode);
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || coupon.archived) throw new CouponNotFoundError();
  return coupon;
}

// ---------------------------------------------------------------------------
// Admin: CRUD
// ---------------------------------------------------------------------------

export async function getAllCouponsForAdmin() {
  await requireRole("ADMIN");
  return prisma.coupon.findMany({
    where: { archived: false },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
}

export async function getArchivedCouponsForAdmin() {
  await requireRole("ADMIN");
  return prisma.coupon.findMany({
    where: { archived: true },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
}

export async function getCouponForAdmin(id: string) {
  await requireRole("ADMIN");
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw new CouponNotFoundForAdminError();
  return coupon;
}

/** Per-coupon redemption records + totals, for the admin's own visibility
 * into who's using a code and how much it's discounted so far — same
 * pattern as getCsrDonationsForAdmin / getServiceOrdersForAdmin. */
export async function getCouponRedemptionsForAdmin(id: string) {
  await requireRole("ADMIN");
  const [coupon, redemptions] = await Promise.all([
    prisma.coupon.findUnique({ where: { id } }),
    prisma.couponRedemption.findMany({
      where: { couponId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);
  if (!coupon) throw new CouponNotFoundForAdminError();

  const totalDiscountGiven = redemptions.reduce(
    (sum, r) => sum + (Number(r.originalAmount) - Number(r.discountedAmount)),
    0
  );

  return { coupon, redemptions, totalDiscountGiven, redemptionCount: redemptions.length };
}

export async function createCoupon(input: CreateCouponInput) {
  const admin = await requireRole("ADMIN");
  const data = createCouponSchema.parse(input);
  const code = normalizeCode(data.code);

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) throw new DuplicateCouponCodeError(code);

  return prisma.coupon.create({
    data: {
      code,
      discountPercent: data.discountPercent,
      usageLimitPerUser: data.usageLimitPerUser,
      createdById: admin.id,
    },
  });
}

export async function updateCoupon(id: string, input: UpdateCouponInput) {
  await requireRole("ADMIN");
  const data = updateCouponSchema.parse(input);
  const code = normalizeCode(data.code);

  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new CouponNotFoundForAdminError();

  if (code !== existing.code) {
    const codeTaken = await prisma.coupon.findUnique({ where: { code } });
    if (codeTaken) throw new DuplicateCouponCodeError(code);
  }

  return prisma.coupon.update({
    where: { id },
    data: { code, discountPercent: data.discountPercent, usageLimitPerUser: data.usageLimitPerUser },
  });
}

/** Soft delete — the "delete" action from the admin's point of view, same
 * convention as archiveInsurancePolicy(): never a hard DELETE, so past
 * CouponRedemption rows (which reference this coupon via a Restrict FK)
 * always keep a valid, auditable trail. An archived coupon simply stops
 * resolving for new redemptions (see resolveCoupon above). */
export async function archiveCoupon(id: string) {
  await requireRole("ADMIN");
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new CouponNotFoundForAdminError();
  return prisma.coupon.update({ where: { id }, data: { archived: true } });
}

export async function unarchiveCoupon(id: string) {
  await requireRole("ADMIN");
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new CouponNotFoundForAdminError();
  return prisma.coupon.update({ where: { id }, data: { archived: false } });
}

// ---------------------------------------------------------------------------
// Public: checking + redeeming (Featured Listings, Service orders only —
// see the module comment above)
// ---------------------------------------------------------------------------

/**
 * Resolves a coupon code against a given amount and (when available) an
 * identity, WITHOUT recording a redemption — used both for the client's
 * live "Apply" preview and as the first half of the real checkout flow in
 * featured-service.ts / service-catalog-service.ts.
 *
 * The usage-limit check only runs when an identity is supplied. At actual
 * checkout time an identity is always available (the signed-in seller for
 * Featured Listings, the phone number just submitted for Service orders)
 * and callers MUST pass it there — omitting it is only valid for a
 * best-effort preview before that identity is known (e.g. before a Service
 * order's phone field has been filled in yet).
 */
export async function checkCoupon({
  code,
  amount,
  userId,
  customerPhone,
}: {
  code: string;
  amount: number;
  userId?: string;
  customerPhone?: string;
}) {
  const coupon = await resolveCoupon(code);

  if (userId || customerPhone) {
    const usageCount = await prisma.couponRedemption.count({
      where: userId ? { couponId: coupon.id, userId } : { couponId: coupon.id, customerPhone },
    });
    if (usageCount >= coupon.usageLimitPerUser) {
      throw new CouponUsageLimitExceededError();
    }
  }

  return {
    couponId: coupon.id,
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    discountedAmount: computeDiscountedAmount(amount, coupon.discountPercent),
  };
}

/**
 * Records that a coupon was actually applied to a real purchase — called
 * only from within startFeatureSubscription()/initiateServiceOrder(),
 * immediately after checkCoupon() and after the subscription/order row
 * they're attached to has been created. This is the row
 * checkCoupon()'s own usage-limit check counts against for future
 * redemptions by the same identity.
 *
 * There is a small window between checkCoupon() and this call where two
 * concurrent checkouts from the same identity could both pass the limit
 * check and both redeem — the same class of best-effort race already
 * accepted elsewhere in this app (see rate-limit.ts's in-memory counter).
 * Not a financial-integrity risk: the amount charged is still always
 * computed server-side per request, never trusted from the client.
 */
export async function recordCouponRedemption({
  couponId,
  scope,
  userId,
  customerPhone,
  discountPercent,
  originalAmount,
  discountedAmount,
  subscriptionId,
  serviceOrderId,
}: {
  couponId: string;
  scope: CouponScope;
  userId?: string;
  customerPhone?: string;
  discountPercent: number;
  originalAmount: number;
  discountedAmount: number;
  subscriptionId?: string;
  serviceOrderId?: string;
}) {
  return prisma.couponRedemption.create({
    data: {
      couponId,
      scope,
      userId,
      customerPhone,
      discountPercent,
      originalAmount,
      discountedAmount,
      subscriptionId,
      serviceOrderId,
    },
  });
}
