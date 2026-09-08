import "server-only";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, AuthorizationError } from "@/server/authorization/ownership";
import { saveInsurancePolicyImage, deleteInsurancePolicyImage, InvalidImageError } from "@/lib/storage";
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
  createInsurancePolicySchema,
  updateInsurancePolicySchema,
  purchaseInsurancePolicySchema,
  type CreateInsurancePolicyInput,
  type UpdateInsurancePolicyInput,
  type PurchaseInsurancePolicyInput,
} from "@/server/validation/insurance-schema";

// ----------------------------------------------------------------------------
// Car Insurance Cover — admin-authored policy offerings shown publicly at
// /services/car-insurance. The ONLY module that writes to InsurancePolicy,
// same convention as event-service.ts owning Event. Every mutation requires
// ADMIN — this mirrors Events exactly (single flyer image, published gate)
// with a starting price added and an `archived` soft-delete step layered on
// top, since the spec asked for delete/archive specifically, not just
// publish/unpublish.
// ----------------------------------------------------------------------------

export class InsurancePolicyNotFoundError extends Error {
  constructor() {
    super("This insurance policy could not be found.");
    this.name = "InsurancePolicyNotFoundError";
  }
}

export class InsurancePolicyNotOrderableError extends Error {
  constructor() {
    super("This policy isn't currently available to purchase online.");
    this.name = "InsurancePolicyNotOrderableError";
  }
}

/** Public: only published, non-archived policies, oldest-created first (a
 * stable, predictable order — there's no natural date field to sort by the
 * way Events has eventDate). */
export async function getPublishedInsurancePolicies() {
  return prisma.insurancePolicy.findMany({
    where: { published: true, archived: false },
    orderBy: { createdAt: "asc" },
  });
}

/** Public: a single published, non-archived policy — backs the
 * purchase/detail page. Never returns a draft or archived policy to a
 * non-admin (returns null instead, same "not found" treatment as a bad id,
 * so a draft policy's existence isn't leaked). */
export async function getPublishedInsurancePolicyById(id: string) {
  return prisma.insurancePolicy.findFirst({
    where: { id, published: true, archived: false },
  });
}

const ADMIN_PAGE_SIZE = 20;

/** Admin-only: active (non-archived) policies, any publish state. Archived
 * ones are deliberately excluded from the default list — see
 * getArchivedInsurancePoliciesForAdmin() for those. */
export async function getAllInsurancePoliciesForAdmin({ page = 1 }: { page?: number } = {}) {
  await requireRole("ADMIN");
  const safePage = Math.max(1, page);
  const where = { archived: false };

  const [policies, totalCount] = await Promise.all([
    prisma.insurancePolicy.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.insurancePolicy.count({ where }),
  ]);

  return {
    policies,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE)),
    page: safePage,
  };
}

/** Admin-only: archived policies — the "recently deleted" equivalent, kept
 * separate from the main list so it doesn't clutter day-to-day management,
 * but never actually removed from the database. */
export async function getArchivedInsurancePoliciesForAdmin() {
  await requireRole("ADMIN");
  return prisma.insurancePolicy.findMany({
    where: { archived: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getInsurancePolicyForAdmin(id: string) {
  await requireRole("ADMIN");
  const policy = await prisma.insurancePolicy.findUnique({ where: { id } });
  if (!policy) throw new InsurancePolicyNotFoundError();
  return policy;
}

/** Creates a new policy, unpublished by default — same "draft first,
 * publish as a deliberate second step" convention as createEvent(). */
export async function createInsurancePolicy(input: CreateInsurancePolicyInput, imageFile: File | null) {
  const admin = await requireRole("ADMIN");
  const data = createInsurancePolicySchema.parse(input);

  let image: { imageUrl: string; storageKey: string } | null = null;
  if (imageFile && imageFile.size > 0) {
    image = await saveInsurancePolicyImage(imageFile);
  }

  return prisma.insurancePolicy.create({
    data: {
      title: data.title,
      description: data.description,
      startingPrice: data.startingPrice,
      imageUrl: image?.imageUrl,
      imageStorageKey: image?.storageKey,
      createdById: admin.id,
    },
  });
}

export async function updateInsurancePolicy(
  id: string,
  input: UpdateInsurancePolicyInput,
  imageFile: File | null
) {
  await requireRole("ADMIN");
  const data = updateInsurancePolicySchema.parse(input);

  const existing = await prisma.insurancePolicy.findUnique({ where: { id } });
  if (!existing) throw new InsurancePolicyNotFoundError();

  let imageUrl = existing.imageUrl;
  let imageStorageKey = existing.imageStorageKey;
  if (imageFile && imageFile.size > 0) {
    const image = await saveInsurancePolicyImage(imageFile);
    imageUrl = image.imageUrl;
    imageStorageKey = image.storageKey;
    // Old file is orphaned on disk otherwise — same cleanup convention as
    // updateEvent(). Never fatal: a failed delete of the old file must not
    // block the successful update.
    if (existing.imageStorageKey) {
      await deleteInsurancePolicyImage(existing.imageStorageKey).catch(() => {});
    }
  }

  return prisma.insurancePolicy.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      startingPrice: data.startingPrice,
      imageUrl,
      imageStorageKey,
    },
  });
}

export async function setInsurancePolicyPublished(id: string, published: boolean) {
  await requireRole("ADMIN");
  const existing = await prisma.insurancePolicy.findUnique({ where: { id } });
  if (!existing) throw new InsurancePolicyNotFoundError();
  if (existing.archived) {
    throw new AuthorizationError("Unarchive this policy before publishing it.");
  }
  return prisma.insurancePolicy.update({ where: { id }, data: { published } });
}

/** Soft delete — the "delete" action from the admin's point of view. Force-
 * unpublishes at the same time (an archived policy is never publicly
 * visible regardless of its old published value) but keeps the row and its
 * uploaded image intact, so it can always be restored via
 * unarchiveInsurancePolicy() rather than needing to be recreated. */
export async function archiveInsurancePolicy(id: string) {
  await requireRole("ADMIN");
  const existing = await prisma.insurancePolicy.findUnique({ where: { id } });
  if (!existing) throw new InsurancePolicyNotFoundError();
  return prisma.insurancePolicy.update({
    where: { id },
    data: { archived: true, published: false },
  });
}

/** Restores an archived policy back to the normal (draft) list — it still
 * has to be explicitly published again afterward, same as any other draft. */
export async function unarchiveInsurancePolicy(id: string) {
  await requireRole("ADMIN");
  const existing = await prisma.insurancePolicy.findUnique({ where: { id } });
  if (!existing) throw new InsurancePolicyNotFoundError();
  return prisma.insurancePolicy.update({ where: { id }, data: { archived: false } });
}

// ---------------------------------------------------------------------------
// Admin: purchase records
// ---------------------------------------------------------------------------

/** View-only, per policy — purchase records + totals (mirrors
 * getCsrDonationsForAdmin / getServiceOrdersForAdmin). The only way a
 * purchase's status changes is the webhook/dev-simulate callback path —
 * no admin edit action exists. */
export async function getInsurancePurchasesForAdmin(policyId: string) {
  await requireRole("ADMIN");

  const [policy, purchases] = await Promise.all([
    prisma.insurancePolicy.findUnique({ where: { id: policyId } }),
    prisma.insurancePurchase.findMany({ where: { policyId }, orderBy: { initiatedAt: "desc" } }),
  ]);
  if (!policy) throw new InsurancePolicyNotFoundError();

  const successfulPurchases = purchases.filter((p) => p.status === "SUCCESS");
  const totalRevenue = successfulPurchases.reduce((sum, p) => sum + Number(p.amount), 0);

  return { policy, purchases, totalRevenue, purchaseCount: successfulPurchases.length };
}

// ---------------------------------------------------------------------------
// Public: purchasing + payment
// ---------------------------------------------------------------------------

/** Customer buys a published policy — no account required. Creates a
 * PENDING InsurancePurchase whose `amount` is taken directly from the
 * policy's own current `startingPrice` (never from client input), then
 * triggers an M-Pesa STK push against the site's one shared Till (see
 * mpesa.ts — this InsurancePurchase row, not a separate Till, is what
 * identifies the payment as an insurance purchase). The purchase only
 * becomes SUCCESS when handleInsurancePurchaseCallback()
 * below receives a matching successful callback — never as a side effect
 * of this function returning without error. */
export async function initiateInsurancePurchase(input: PurchaseInsurancePolicyInput) {
  const data = purchaseInsurancePolicySchema.parse(input);
  const phone = normalizeKenyanPhone(data.customerPhone);

  // Rate-limited by phone (no account/session to key off — purchases are
  // anonymous, same as CSR donations / service orders) — bounds STK-push
  // spam toward one number and PENDING-row spam from a stuck/retried client.
  checkRateLimit(`insurance-purchase:${phone}`, { max: 10, windowMs: 60 * 60 * 1000 });

  const policy = await prisma.insurancePolicy.findUnique({ where: { id: data.policyId } });
  if (!policy) throw new InsurancePolicyNotFoundError();
  if (!policy.published || policy.archived) throw new InsurancePolicyNotOrderableError();

  const purchase = await prisma.insurancePurchase.create({
    data: {
      policyId: policy.id,
      customerName: data.customerName || null,
      customerEmail: data.customerEmail || null,
      customerPhone: phone,
      // Server-derived from the policy row itself — the amount charged can
      // never be influenced by anything the client sends.
      amount: policy.startingPrice,
      currency: policy.currency,
      status: "PENDING",
    },
  });

  try {
    let checkoutRequestId: string;

    if (isMpesaConfigured()) {
      const result = await initiateStkPush({
        phone,
        amount: Number(policy.startingPrice),
        accountReference: policy.title.slice(0, 12) || "INSURANCE",
        transactionDesc: "Insurance",
      });
      checkoutRequestId = result.checkoutRequestId;
    } else if (process.env.NODE_ENV !== "production") {
      // DEV/TEST ONLY — same fallback pattern as startFeatureSubscription /
      // initiateCsrDonation / initiateServiceOrder: no real Till configured
      // yet in local dev, so this synthesizes a request id to exercise the
      // full PENDING -> (devSimulateInsurancePurchaseCallback) -> SUCCESS
      // path. Hard-blocked in production regardless of this branch.
      checkoutRequestId = `dev-${crypto.randomUUID()}`;
    } else {
      throw new MpesaNotConfiguredError();
    }

    await prisma.insurancePurchase.update({
      where: { id: purchase.id },
      data: { providerTransactionId: checkoutRequestId },
    });
  } catch (error) {
    await prisma.insurancePurchase.update({
      where: { id: purchase.id },
      data: { status: "FAILED", completedAt: new Date() },
    });
    throw error;
  }

  return { purchaseId: purchase.id };
}

/**
 * Idempotent M-Pesa callback handler for insurance purchases — mirrors
 * handleMpesaCallback()/handleCsrDonationCallback()/
 * handleServiceOrderCallback() exactly, including their idempotency
 * guarantee (a second callback for the same CheckoutRequestID finds the
 * row already non-PENDING and no-ops, safely absorbing Daraja's documented
 * retries and any duplicate delivery).
 */
export async function handleInsurancePurchaseCallback(callback: MpesaStkCallback) {
  const purchase = await prisma.insurancePurchase.findUnique({
    where: { providerTransactionId: callback.CheckoutRequestID },
  });

  if (!purchase) {
    return { matched: false as const };
  }

  if (purchase.status !== "PENDING") {
    return { matched: true as const, alreadyProcessed: true as const };
  }

  const metadata = callback as unknown as Prisma.InputJsonValue;
  // ResultCode 0 = success; anything else covers failed AND cancelled
  // attempts alike (Daraja doesn't distinguish them with a separate code —
  // both just fail to reach 0), so both land in FAILED here.
  const isSuccess = callback.ResultCode === 0;

  await prisma.insurancePurchase.update({
    where: { id: purchase.id },
    data: {
      status: isSuccess ? "SUCCESS" : "FAILED",
      completedAt: new Date(),
      metadata,
    },
  });

  return { matched: true as const, success: isSuccess };
}

export function extractInsurancePurchaseReceipt(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = callbackMetadataValue(metadata as MpesaStkCallback, "MpesaReceiptNumber");
  return value === undefined ? undefined : String(value);
}

/**
 * DEV/TEST ONLY. Exercises the full purchase confirmation path
 * (initiateInsurancePurchase() -> this -> handleInsurancePurchaseCallback()
 * -> purchase SUCCESS) before real M-Pesa credentials are configured. Calls
 * the exact same handleInsurancePurchaseCallback() the real webhook calls.
 *
 * Like the CSR/service-order equivalents, this can't check "does the caller
 * own this purchase" — purchases have no account/session to check against,
 * by design. The purchaseId itself (a random cuid, never enumerable/listed
 * publicly) is the only thing gating this, an acceptable bound for a
 * dev-only tool that is hard-blocked outside development regardless.
 */
export async function devSimulateInsurancePurchaseCallback(
  purchaseId: string,
  outcome: "success" | "failure"
) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Payment simulation is not available in production.");
  }

  const purchase = await prisma.insurancePurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) throw new InsurancePolicyNotFoundError();
  if (!purchase.providerTransactionId) {
    throw new Error("This purchase never reached the M-Pesa request stage.");
  }

  const callback: MpesaStkCallback = {
    MerchantRequestID: "dev-simulated",
    CheckoutRequestID: purchase.providerTransactionId,
    ResultCode: outcome === "success" ? 0 : 1032,
    ResultDesc:
      outcome === "success"
        ? "The service request is processed successfully."
        : "Request cancelled by user.",
    ...(outcome === "success"
      ? {
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: Number(purchase.amount) },
              { Name: "MpesaReceiptNumber", Value: `DEV${Date.now().toString().slice(-8)}` },
              { Name: "PhoneNumber", Value: 254700000000 },
            ],
          },
        }
      : {}),
  };

  return handleInsurancePurchaseCallback(callback);
}

export { InvalidImageError };
