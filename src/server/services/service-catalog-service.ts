import "server-only";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SwrCache } from "@/lib/swr-cache";
import { requireRole, AuthorizationError } from "@/server/authorization/ownership";
import { saveServiceImage, deleteServiceImage, InvalidImageError, MAX_IMAGES_PER_SERVICE } from "@/lib/storage";
import { checkRateLimit } from "@/server/services/rate-limit";
import {
  initiateStkPush,
  normalizeKenyanPhone,
  callbackMetadataValue,
  isMpesaConfigured,
  MpesaNotConfiguredError,
  type MpesaStkCallback,
} from "@/lib/mpesa";
import {
  createServiceSchema,
  updateServiceSchema,
  orderServiceSchema,
  type CreateServiceInput,
  type UpdateServiceInput,
  type OrderServiceInput,
} from "@/server/validation/service-schema";
import { checkCoupon, recordCouponRedemption } from "@/server/services/coupon-service";

// ----------------------------------------------------------------------------
// Orderable service catalog (admin-managed listings for the existing
// /services/* pages) + online ordering/payment. The ONLY module that writes
// to Service/ServiceImage/ServiceOrder, same "one owning service per model"
// convention as csr-service.ts / event-service.ts.
//
// This is purely additive to the existing five static /services/* pages —
// each page fetches its own Service by a fixed slug and, if one exists and
// is published, renders an order/pay panel alongside its existing content.
// No existing page copy, layout, or route is touched by this module.
//
// Payment goes through the site's one shared M-Pesa Till (see mpesa.ts —
// every payment surface on the site pays into the same MPESA_TILL_NUMBER;
// this ServiceOrder row, not a separate Till, is what identifies the
// payment as a service order). Central rule (same everywhere else):
// an order's status is NEVER set from a browser response — only
// handleServiceOrderCallback() below, after a server-confirmed M-Pesa
// callback, ever moves it out of PENDING.
// ----------------------------------------------------------------------------

export class ServiceNotFoundError extends Error {
  constructor() {
    super("This service could not be found.");
    this.name = "ServiceNotFoundError";
  }
}

export class ServiceNotOrderableError extends Error {
  constructor() {
    super("This service isn't currently available to order online.");
    this.name = "ServiceNotOrderableError";
  }
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

// Public reads are the same for every visitor, so they're kept in memory
// (see lib/swr-cache.ts) instead of costing a database round trip on every
// page view. Any write to these tables clears it (see lib/prisma.ts).
const publicCache = new SwrCache({ name: "public-services", freshMs: 30_000, maxStaleMs: 24 * 60 * 60_000, maxEntries: 200 });

/** Public: used by each of the five /services/* pages to look up their own
 * orderable listing by the page's fixed slug. Returns null if the admin
 * hasn't created one yet, or it's still a draft — callers treat null as
 * "render the page exactly as before, no order panel." */
export async function getPublishedServiceBySlug(slug: string) {
  return publicCache.get(`slug:${slug}`, () =>
    prisma.service.findFirst({
      where: { slug, published: true },
      include: { images: { orderBy: { displayOrder: "asc" } } },
    })
  );
}

// ---------------------------------------------------------------------------
// Admin: CRUD
// ---------------------------------------------------------------------------

export async function getAllServicesForAdmin() {
  await requireRole("ADMIN");
  return prisma.service.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: { where: { status: "SUCCESS" } } } } },
  });
}

export async function getServiceForAdmin(id: string) {
  await requireRole("ADMIN");
  const service = await prisma.service.findUnique({
    where: { id },
    include: { images: { orderBy: { displayOrder: "asc" } } },
  });
  if (!service) throw new ServiceNotFoundError();
  return service;
}

export class DuplicateServiceSlugError extends Error {
  constructor(label: string) {
    super(`A service already exists for "${label}". Edit that one instead of creating a second.`);
    this.name = "DuplicateServiceSlugError";
  }
}

/** Creates a new orderable service, unpublished by default — same
 * "draft first, publish as a deliberate second step" convention as
 * createEvent()/createCsrInitiative(). One service per page slug — the
 * DB's @unique constraint is the real guarantee, this is just a friendlier
 * error than a raw constraint violation. */
export async function createService(input: CreateServiceInput) {
  const admin = await requireRole("ADMIN");
  const data = createServiceSchema.parse(input);

  const existing = await prisma.service.findUnique({ where: { slug: data.slug } });
  if (existing) throw new DuplicateServiceSlugError(data.slug);

  return prisma.service.create({
    data: {
      slug: data.slug,
      title: data.title,
      description: data.description,
      price: data.price,
      createdById: admin.id,
    },
  });
}

export async function updateService(id: string, input: UpdateServiceInput) {
  await requireRole("ADMIN");
  const data = updateServiceSchema.parse(input);

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) throw new ServiceNotFoundError();

  return prisma.service.update({
    where: { id },
    data: { title: data.title, description: data.description, price: data.price },
  });
}

export async function setServicePublished(id: string, published: boolean) {
  await requireRole("ADMIN");
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) throw new ServiceNotFoundError();
  return prisma.service.update({ where: { id }, data: { published } });
}

// ---------------------------------------------------------------------------
// Admin: gallery images
// ---------------------------------------------------------------------------

export async function addServiceImage(serviceId: string, file: File) {
  await requireRole("ADMIN");
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new ServiceNotFoundError();

  const existingCount = await prisma.serviceImage.count({ where: { serviceId } });
  if (existingCount >= MAX_IMAGES_PER_SERVICE) {
    throw new InvalidImageError(`A service can have at most ${MAX_IMAGES_PER_SERVICE} photos.`);
  }

  const { imageUrl, storageKey } = await saveServiceImage(serviceId, file);

  return prisma.serviceImage.create({
    data: { serviceId, imageUrl, storageKey, displayOrder: existingCount },
  });
}

export async function removeServiceImage(serviceId: string, imageId: string) {
  await requireRole("ADMIN");
  const image = await prisma.serviceImage.findFirst({ where: { id: imageId, serviceId } });
  if (!image) throw new AuthorizationError("Image not found on this service.");

  await deleteServiceImage(image.storageKey ?? "");
  await prisma.serviceImage.delete({ where: { id: image.id } });
}

// ---------------------------------------------------------------------------
// Admin: order records
// ---------------------------------------------------------------------------

/** View-only, per service — order records + totals (mirrors
 * getCsrDonationsForAdmin). The only way an order's status changes is the
 * webhook/dev-simulate callback path — no admin edit action exists. */
export async function getServiceOrdersForAdmin(serviceId: string) {
  await requireRole("ADMIN");

  const [service, orders] = await Promise.all([
    prisma.service.findUnique({ where: { id: serviceId } }),
    prisma.serviceOrder.findMany({ where: { serviceId }, orderBy: { initiatedAt: "desc" } }),
  ]);
  if (!service) throw new ServiceNotFoundError();

  const successfulOrders = orders.filter((o) => o.status === "SUCCESS");
  const totalRevenue = successfulOrders.reduce((sum, o) => sum + Number(o.amount), 0);

  return { service, orders, totalRevenue, orderCount: successfulOrders.length };
}

// ---------------------------------------------------------------------------
// Public: ordering + payment
// ---------------------------------------------------------------------------

/** Customer orders a published service — no account required. Creates a
 * PENDING ServiceOrder (snapshotting the service's current price, minus
 * any applied coupon), then triggers an M-Pesa STK push against the
 * site's one shared Till. The order only becomes SUCCESS when
 * handleServiceOrderCallback() below receives a matching successful
 * callback — never as a side effect of this function returning without
 * error. An optional couponCode is checked and applied server-side before
 * the payment amount is ever fixed (see coupon-service.ts); a 100%-off
 * code completes the order immediately instead of going through M-Pesa at
 * all, since there's nothing left to charge. */
export async function initiateServiceOrder(input: OrderServiceInput) {
  const data = orderServiceSchema.parse(input);
  const phone = normalizeKenyanPhone(data.customerPhone);

  // Rate-limited by phone (no account/session to key off — orders are
  // anonymous, same as CSR donations) — bounds STK-push spam toward one
  // number and PENDING-row spam from a stuck/retried client.
  checkRateLimit(`service-order:${phone}`, { max: 10, windowMs: 60 * 60 * 1000 });

  const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
  if (!service) throw new ServiceNotFoundError();
  if (!service.published) throw new ServiceNotOrderableError();

  // Coupon is checked BEFORE any row is created, so a bad/expired/
  // over-used code fails fast without leaving an orphaned PENDING order
  // behind. The phone number just submitted is the identity the
  // usage-limit check runs against — unlike the client-side preview
  // (which may run before the phone field is filled in), this always
  // has one, so the limit is always enforced here.
  let finalAmount = Number(service.price);
  let appliedCoupon: { couponId: string; discountPercent: number } | null = null;
  if (data.couponCode) {
    const result = await checkCoupon({ code: data.couponCode, amount: finalAmount, customerPhone: phone });
    finalAmount = result.discountedAmount;
    appliedCoupon = { couponId: result.couponId, discountPercent: result.discountPercent };
  }

  const order = await prisma.serviceOrder.create({
    data: {
      serviceId: service.id,
      customerName: data.customerName || null,
      customerEmail: data.customerEmail || null,
      customerPhone: phone,
      amount: finalAmount,
      currency: service.currency,
      status: "PENDING",
    },
  });

  // The redemption is recorded now that there's a real order to attach it
  // to — this row is what the NEXT checkCoupon() call for this same
  // phone+code counts against.
  if (appliedCoupon) {
    await recordCouponRedemption({
      couponId: appliedCoupon.couponId,
      scope: "SERVICE_ORDER",
      customerPhone: phone,
      discountPercent: appliedCoupon.discountPercent,
      originalAmount: Number(service.price),
      discountedAmount: finalAmount,
      serviceOrderId: order.id,
    });
  }

  // A 100%-off coupon means there's nothing left to charge — Safaricom has
  // no STK push for KES 0, so this completes the order directly rather
  // than waiting on a callback that would never arrive. Still fully
  // server-derived (the coupon's discount came from the DB, never the
  // client), so this doesn't relax "never confirm from a browser
  // response" — there is no browser response involved at all here.
  if (finalAmount <= 0) {
    await prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        providerTransactionId: `coupon-${order.id}`,
        metadata: { freeViaCoupon: true, couponCode: data.couponCode },
      },
    });
    return { orderId: order.id, free: true };
  }

  try {
    let checkoutRequestId: string;

    if (isMpesaConfigured()) {
      const result = await initiateStkPush({
        phone,
        amount: finalAmount,
        accountReference: service.slug.slice(0, 12) || "SERVICE",
        transactionDesc: "Service order",
      });
      checkoutRequestId = result.checkoutRequestId;
    } else if (process.env.NODE_ENV !== "production") {
      // DEV/TEST ONLY — same fallback pattern as startFeatureSubscription /
      // initiateCsrDonation: no real Till configured yet in local dev, so
      // this synthesizes a request id to exercise the full
      // PENDING -> (devSimulateServiceOrderCallback) -> SUCCESS path.
      // Hard-blocked in production regardless of this branch.
      checkoutRequestId = `dev-${crypto.randomUUID()}`;
    } else {
      throw new MpesaNotConfiguredError();
    }

    await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { providerTransactionId: checkoutRequestId },
    });
  } catch (error) {
    await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { status: "FAILED", completedAt: new Date() },
    });
    throw error;
  }

  return { orderId: order.id, free: false };
}

/**
 * Idempotent M-Pesa callback handler for service orders — mirrors
 * handleMpesaCallback()/handleCsrDonationCallback() exactly, including
 * their idempotency guarantee (a second callback for the same
 * CheckoutRequestID finds the row already non-PENDING and no-ops).
 */
export async function handleServiceOrderCallback(callback: MpesaStkCallback) {
  const order = await prisma.serviceOrder.findUnique({
    where: { providerTransactionId: callback.CheckoutRequestID },
  });

  if (!order) {
    return { matched: false as const };
  }

  if (order.status !== "PENDING") {
    return { matched: true as const, alreadyProcessed: true as const };
  }

  const metadata = callback as unknown as Prisma.InputJsonValue;
  const isSuccess = callback.ResultCode === 0;

  await prisma.serviceOrder.update({
    where: { id: order.id },
    data: {
      status: isSuccess ? "SUCCESS" : "FAILED",
      completedAt: new Date(),
      metadata,
    },
  });

  return { matched: true as const, success: isSuccess };
}

export function extractServiceOrderReceipt(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = callbackMetadataValue(metadata as MpesaStkCallback, "MpesaReceiptNumber");
  return value === undefined ? undefined : String(value);
}

/**
 * DEV/TEST ONLY. Exercises the full order activation path
 * (initiateServiceOrder() -> this -> handleServiceOrderCallback() -> order
 * SUCCESS) before real M-Pesa credentials are configured. Calls the exact
 * same handleServiceOrderCallback() the real webhook calls.
 *
 * Like devSimulateCsrDonationCallback, this can't check "does the caller
 * own this order" — orders have no account/session to check against, by
 * design. The orderId itself (a random cuid, never enumerable/listed
 * publicly) is the only thing gating this, an acceptable bound for a
 * dev-only tool that is hard-blocked outside development regardless.
 */
export async function devSimulateServiceOrderCallback(orderId: string, outcome: "success" | "failure") {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Payment simulation is not available in production.");
  }

  const order = await prisma.serviceOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new ServiceNotFoundError();
  if (!order.providerTransactionId) {
    throw new Error("This order never reached the M-Pesa request stage.");
  }

  const callback: MpesaStkCallback = {
    MerchantRequestID: "dev-simulated",
    CheckoutRequestID: order.providerTransactionId,
    ResultCode: outcome === "success" ? 0 : 1032,
    ResultDesc:
      outcome === "success"
        ? "The service request is processed successfully."
        : "Request cancelled by user.",
    ...(outcome === "success"
      ? {
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: Number(order.amount) },
              { Name: "MpesaReceiptNumber", Value: `DEV${Date.now().toString().slice(-8)}` },
              { Name: "PhoneNumber", Value: 254700000000 },
            ],
          },
        }
      : {}),
  };

  return handleServiceOrderCallback(callback);
}

export { InvalidImageError };
