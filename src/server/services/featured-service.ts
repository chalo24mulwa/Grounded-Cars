import "server-only";
import crypto from "node:crypto";
import { Prisma, type FeaturedSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, AuthorizationError } from "@/server/authorization/ownership";
import {
  initiateStkPush,
  normalizeKenyanPhone,
  callbackMetadataValue,
  isMpesaConfigured,
  MpesaNotConfiguredError,
  type MpesaStkCallback,
} from "@/lib/mpesa";
import { startFeatureSchema, type StartFeatureInput } from "@/server/validation/featured-schema";
import { notify } from "@/server/services/notification-service";
import { checkRateLimit } from "@/server/services/rate-limit";
import { checkCoupon, recordCouponRedemption } from "@/server/services/coupon-service";

// ----------------------------------------------------------------------------
// Featured-listing subscriptions & payments. This is the ONLY module that
// writes to FeaturedSubscription/PaymentTransaction, same convention as
// listing-service.ts owning CarListing/CarImage writes.
//
// Central rule (spec): "is this listing featured" is NEVER read off a
// stored boolean — every read in this file re-derives it live from
// FeaturedSubscription.status + expiresAt + the listing's own current
// status. See getFeaturedListingIds() / isListingCurrentlyFeatured().
// ----------------------------------------------------------------------------

export class ListingNotActiveError extends Error {
  constructor() {
    super("Only active listings can be featured.");
    this.name = "ListingNotActiveError";
  }
}

export class PlanNotFoundError extends Error {
  constructor() {
    super("That featured plan is not available.");
    this.name = "PlanNotFoundError";
  }
}

export async function getActiveFeaturedPlans() {
  return prisma.featuredPlan.findMany({ where: { active: true }, orderBy: { durationDays: "asc" } });
}

const ADMIN_PAGE_SIZE = 20;

/**
 * Admin-only, read-only view across ALL sellers' featured subscriptions —
 * active, expired, cancelled, and payment-failed, plus each subscription's
 * payment record(s). This is deliberately view-only: the spec explicitly
 * says not to allow arbitrary editing of verified payment records without
 * an audit trail, and no such editing UI/action exists — an admin can see
 * everything here but the only way any of these rows change is through the
 * normal purchase/webhook/expiry-sweep flows already built.
 */
export async function getAllSubscriptionsForAdmin({
  status,
  page = 1,
}: {
  status?: FeaturedSubscriptionStatus;
  page?: number;
} = {}) {
  await requireRole("ADMIN");

  const safePage = Math.max(1, page);
  const where = status ? { status } : {};

  const [subscriptions, totalCount] = await Promise.all([
    prisma.featuredSubscription.findMany({
      where,
      include: {
        plan: true,
        user: { select: { id: true, name: true, email: true } },
        listing: { select: { id: true, title: true, slug: true, status: true } },
        payments: { orderBy: { initiatedAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.featuredSubscription.count({ where }),
  ]);

  return {
    subscriptions,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE)),
    page: safePage,
  };
}

/** Admin-only: every plan regardless of active/retired status — backs the
 * plan-management table at /admin. Purchases already reference plans by id
 * (FeaturedSubscription.planId, onDelete: Restrict), so retiring a plan
 * (active: false) is the only safe way to stop new sales of it — deleting a
 * plan row is never offered, since that would orphan historical purchases. */
export async function getAllFeaturedPlansForAdmin() {
  await requireRole("ADMIN");
  return prisma.featuredPlan.findMany({ orderBy: { durationDays: "asc" } });
}

export async function createFeaturedPlan(input: {
  name: string;
  durationDays: number;
  price: number;
  currency: string;
}) {
  await requireRole("ADMIN");
  return prisma.featuredPlan.create({ data: input });
}

export async function setFeaturedPlanActive(planId: string, active: boolean) {
  await requireRole("ADMIN");
  return prisma.featuredPlan.update({ where: { id: planId }, data: { active } });
}

/**
 * Live check: a listing is "currently featured" only if ALL of —
 *   1. It has a FeaturedSubscription with status ACTIVE.
 *   2. That subscription's expiresAt is still in the future.
 *   3. The listing's own status is still ACTIVE (a listing marked SOLD or
 *      ARCHIVED can never be promoted as featured, no matter how much
 *      subscription time remains — spec: "SOLD listings must never be
 *      promoted as available featured cars").
 *
 * Returns the ids as a Set for O(1) membership checks against a page of
 * listings, and the underlying rows are also usable for ordering.
 */
export async function getFeaturedListingIds(): Promise<Set<string>> {
  const now = new Date();
  const rows = await prisma.featuredSubscription.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now }, listing: { status: "ACTIVE" } },
    select: { listingId: true },
    distinct: ["listingId"],
  });
  return new Set(rows.map((r) => r.listingId));
}

/** Seller starts a featured-listing purchase for one of their own ACTIVE
 * listings: creates a PENDING subscription + PENDING payment, then
 * triggers the M-Pesa STK push. The subscription only becomes ACTIVE when
 * handleMpesaCallback() below receives a matching successful callback —
 * never as a side effect of this function returning without error. An
 * optional couponCode is checked and applied server-side before the
 * payment amount is ever fixed (see coupon-service.ts); a 100%-off code
 * activates the subscription immediately instead of going through M-Pesa
 * at all, since there's nothing left to charge. */
export async function startFeatureSubscription(input: StartFeatureInput) {
  const user = await requireRole("SELLER", "ADMIN", "MODERATOR");
  // Each attempt sends a real STK push (or, in dev, simulates one) and
  // creates PENDING subscription/payment rows — bounding attempts per user
  // protects both the M-Pesa integration from being hammered and the
  // database from PENDING-row spam from a stuck/retried client.
  checkRateLimit(`feature-purchase:${user.id}`, { max: 10, windowMs: 60 * 60 * 1000 });
  const data = startFeatureSchema.parse(input);

  // Fresh DB lookup — never trusts a client-supplied sellerId. This isn't a
  // listing-status transition, so requireListingOwnership (which is
  // status-transition-shaped) doesn't fit; the same "re-verify server-side"
  // principle is applied directly here instead.
  const listing = await prisma.carListing.findUnique({ where: { id: data.listingId } });
  if (!listing) throw new AuthorizationError("Listing not found.");
  if (listing.sellerId !== user.id && user.role !== "ADMIN") {
    // A MODERATOR still needs to own the listing they're featuring — this
    // isn't the "review someone else's listing" permission, just their own
    // full seller access (see requireRole above).
    throw new AuthorizationError("You do not own this listing.");
  }
  if (listing.status !== "ACTIVE") {
    throw new ListingNotActiveError();
  }

  const plan = await prisma.featuredPlan.findFirst({ where: { id: data.planId, active: true } });
  if (!plan) throw new PlanNotFoundError();

  const phone = normalizeKenyanPhone(data.phoneNumber);

  // Coupon is checked BEFORE any row is created, so a bad/expired/
  // over-used code fails fast without leaving an orphaned PENDING
  // subscription/payment behind. The seller (user.id) is always a real,
  // authenticated identity here, so the usage-limit check always applies —
  // unlike the client-side preview, this can never be skipped.
  let finalAmount = Number(plan.price);
  let appliedCoupon: { couponId: string; discountPercent: number } | null = null;
  if (data.couponCode) {
    const result = await checkCoupon({ code: data.couponCode, amount: finalAmount, userId: user.id });
    finalAmount = result.discountedAmount;
    appliedCoupon = { couponId: result.couponId, discountPercent: result.discountPercent };
  }

  const subscription = await prisma.featuredSubscription.create({
    data: { userId: user.id, listingId: listing.id, planId: plan.id, status: "PENDING" },
  });

  const payment = await prisma.paymentTransaction.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.id,
      provider: "MPESA",
      amount: finalAmount,
      currency: plan.currency,
      status: "PENDING",
    },
  });

  // The redemption is recorded now that there's a real subscription/payment
  // to attach it to — this row is what the NEXT checkCoupon() call for this
  // same seller+code counts against.
  if (appliedCoupon) {
    await recordCouponRedemption({
      couponId: appliedCoupon.couponId,
      scope: "FEATURED_LISTING",
      userId: user.id,
      discountPercent: appliedCoupon.discountPercent,
      originalAmount: Number(plan.price),
      discountedAmount: finalAmount,
      subscriptionId: subscription.id,
    });
  }

  // A 100%-off coupon means there's nothing left to charge — Safaricom has
  // no STK push for KES 0, so this activates the subscription directly
  // rather than waiting on a callback that would never arrive. Still fully
  // server-derived (the coupon's discount came from the DB, never the
  // client), so this doesn't relax "never activate from a browser
  // response" — there is no browser response involved at all here.
  if (finalAmount <= 0) {
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          completedAt: new Date(),
          providerTransactionId: `coupon-${payment.id}`,
          metadata: { freeViaCoupon: true, couponCode: data.couponCode },
        },
      }),
      prisma.featuredSubscription.update({
        where: { id: subscription.id },
        data: { status: "ACTIVE", startedAt, expiresAt },
      }),
    ]);

    await notify({
      userId: user.id,
      type: "SUBSCRIPTION_ACTIVATED",
      vars: { listingTitle: listing.title, planName: plan.name, expiresAt: expiresAt.toLocaleDateString() },
      relatedEntityType: "FeaturedSubscription",
      relatedEntityId: subscription.id,
    });

    return { subscriptionId: subscription.id, paymentId: payment.id, free: true };
  }

  try {
    let checkoutRequestId: string;

    if (isMpesaConfigured()) {
      const result = await initiateStkPush({
        phone,
        amount: finalAmount,
        accountReference: listing.slug.slice(0, 12) || "FEATURE",
        transactionDesc: "Featured car",
      });
      checkoutRequestId = result.checkoutRequestId;
    } else if (process.env.NODE_ENV !== "production") {
      // DEV/TEST ONLY. The business Till number isn't available yet, so a
      // real STK push can't be sent — this synthesizes a request id so the
      // PENDING → (devSimulateMpesaCallback) → ACTIVE path is fully
      // testable now rather than only once real credentials exist. The
      // `else` branch below still throws in production regardless of this
      // env var, so this can never fire outside local/staging dev.
      checkoutRequestId = `dev-${crypto.randomUUID()}`;
    } else {
      throw new MpesaNotConfiguredError();
    }

    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: { providerTransactionId: checkoutRequestId },
    });
  } catch (error) {
    // The push itself failed to send (bad number, provider down, etc.) —
    // mark both rows failed rather than leaving them stuck PENDING with
    // nothing that will ever reconcile them.
    await prisma.$transaction([
      prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: { status: "FAILED", completedAt: new Date() },
      }),
      prisma.featuredSubscription.update({
        where: { id: subscription.id },
        data: { status: "PAYMENT_FAILED" },
      }),
    ]);
    throw error;
  }

  return { subscriptionId: subscription.id, paymentId: payment.id, free: false };
}

/**
 * Idempotent M-Pesa callback handler. Looks up the PaymentTransaction by
 * CheckoutRequestID — the ONLY thing that identifies which purchase this
 * callback belongs to; nothing else in the payload is trusted for that.
 * A second callback for the same CheckoutRequestID (Daraja is documented to
 * retry) finds the row already non-PENDING and no-ops — this is what
 * prevents duplicate callbacks from creating duplicate charges/activations.
 */
export async function handleMpesaCallback(callback: MpesaStkCallback) {
  const payment = await prisma.paymentTransaction.findUnique({
    where: { providerTransactionId: callback.CheckoutRequestID },
    include: { subscription: { include: { plan: true, listing: { select: { title: true } } } } },
  });

  if (!payment) {
    // Unrecognized CheckoutRequestID — nothing to activate. Not treated as
    // an error: could be a stale replay from a much earlier session.
    return { matched: false as const };
  }

  if (payment.status !== "PENDING") {
    return { matched: true as const, alreadyProcessed: true as const };
  }

  const metadata = callback as unknown as Prisma.InputJsonValue;
  const isSuccess = callback.ResultCode === 0;

  if (isSuccess) {
    const plan = payment.subscription?.plan;
    const startedAt = new Date();
    const expiresAt = plan
      ? new Date(startedAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)
      : null;

    await prisma.$transaction([
      prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: { status: "SUCCESS", completedAt: new Date(), metadata },
      }),
      ...(payment.subscriptionId
        ? [
            prisma.featuredSubscription.update({
              where: { id: payment.subscriptionId },
              data: { status: "ACTIVE", startedAt, expiresAt },
            }),
          ]
        : []),
    ]);

    if (plan) {
      await notify({
        userId: payment.userId,
        type: "SUBSCRIPTION_ACTIVATED",
        vars: {
          listingTitle: payment.subscription?.listing.title ?? "",
          planName: plan.name,
          expiresAt: expiresAt ? expiresAt.toLocaleDateString() : "",
        },
        relatedEntityType: "FeaturedSubscription",
        relatedEntityId: payment.subscriptionId ?? undefined,
      });
    }
  } else {
    await prisma.$transaction([
      prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: { status: "FAILED", completedAt: new Date(), metadata },
      }),
      ...(payment.subscriptionId
        ? [
            prisma.featuredSubscription.update({
              where: { id: payment.subscriptionId },
              data: { status: "PAYMENT_FAILED" },
            }),
          ]
        : []),
    ]);

    await notify({
      userId: payment.userId,
      type: "PAYMENT_FAILED",
      vars: {
        listingTitle: payment.subscription?.listing.title ?? "",
        amount: Number(payment.amount),
        currency: payment.currency,
      },
      relatedEntityType: "PaymentTransaction",
      relatedEntityId: payment.id,
    });
  }

  return { matched: true as const, success: isSuccess };
}

/** Seller's own subscription + payment history, across all their listings. */
export async function getMyFeaturedSubscriptions() {
  const user = await requireAuth();
  return prisma.featuredSubscription.findMany({
    where: { userId: user.id },
    include: {
      plan: true,
      listing: { select: { id: true, title: true, slug: true, status: true } },
      payments: { orderBy: { initiatedAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Kept separate from featured-metadata parsing so callers never need to
 * import mpesa.ts directly just to read a receipt number back out. */
export function extractMpesaReceipt(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = callbackMetadataValue(metadata as MpesaStkCallback, "MpesaReceiptNumber");
  return value === undefined ? undefined : String(value);
}

/**
 * DEV/TEST ONLY. Real M-Pesa credentials (the business Till number) aren't
 * available yet, so this is the only way to exercise the *entire*
 * activation path — startFeatureSubscription() → this → handleMpesaCallback()
 * → subscription ACTIVE — end to end before Safaricom is wired up. It calls
 * the exact same handleMpesaCallback() the real webhook calls; nothing about
 * subscription activation is special-cased for simulated payments.
 *
 * Hard-blocked outside development so this can never be reachable in
 * production, regardless of what the UI does or doesn't render.
 */
export async function devSimulateMpesaCallback(paymentId: string, outcome: "success" | "failure") {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Payment simulation is not available in production.");
  }

  const user = await requireAuth();
  const payment = await prisma.paymentTransaction.findUnique({ where: { id: paymentId } });
  if (!payment || payment.userId !== user.id) {
    throw new AuthorizationError("Payment not found.");
  }
  if (!payment.providerTransactionId) {
    throw new Error("This payment never reached the M-Pesa request stage.");
  }

  const callback: MpesaStkCallback = {
    MerchantRequestID: "dev-simulated",
    CheckoutRequestID: payment.providerTransactionId,
    ResultCode: outcome === "success" ? 0 : 1032,
    ResultDesc:
      outcome === "success"
        ? "The service request is processed successfully."
        : "Request cancelled by user.",
    ...(outcome === "success"
      ? {
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: Number(payment.amount) },
              { Name: "MpesaReceiptNumber", Value: `DEV${Date.now().toString().slice(-8)}` },
              { Name: "PhoneNumber", Value: 254700000000 },
            ],
          },
        }
      : {}),
  };

  return handleMpesaCallback(callback);
}
