import "server-only";
import crypto from "node:crypto";
import { Prisma, type CsrInitiativeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SwrCache } from "@/lib/swr-cache";
import { requireRole, AuthorizationError } from "@/server/authorization/ownership";
import { saveCsrImage, deleteCsrImage, InvalidImageError, MAX_IMAGES_PER_CSR_INITIATIVE } from "@/lib/storage";
import { slugify } from "@/lib/slugify";
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
  createCsrInitiativeSchema,
  updateCsrInitiativeSchema,
  donateToCsrInitiativeSchema,
  type CreateCsrInitiativeInput,
  type UpdateCsrInitiativeInput,
  type DonateToCsrInitiativeInput,
} from "@/server/validation/csr-schema";

// ----------------------------------------------------------------------------
// Corporate Social Responsibility (CSR) initiatives + donations. The ONLY
// module that writes to CsrInitiative/CsrInitiativeImage/CsrDonation, same
// "one owning service per model" convention as event-service.ts /
// featured-service.ts.
//
// Two independent lifecycle axes on an initiative, deliberately not
// conflated: `published` (is this visible on /csr at all — draft vs live,
// same as Event) and `status` (ACTIVE vs COMPLETED — the initiative's own
// real-world progress, set by an admin). Donations only accept against a
// published, ACTIVE initiative.
//
// Central rule (spec): amountRaised is NEVER incremented from a browser
// response — only handleCsrDonationCallback() below does that, and only
// after matching a server-confirmed M-Pesa callback to a PENDING donation
// row this module itself created.
// ----------------------------------------------------------------------------

export class InitiativeNotFoundError extends Error {
  constructor() {
    super("This initiative could not be found.");
    this.name = "InitiativeNotFoundError";
  }
}

export class InitiativeNotAcceptingDonationsError extends Error {
  constructor() {
    super("This initiative isn't currently accepting donations.");
    this.name = "InitiativeNotAcceptingDonationsError";
  }
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "initiative";
  let candidate = base;
  let suffix = 1;
  // Small table, low contention (admin-only writes) — a loop is simpler and
  // just as safe as a random suffix here, and produces cleaner URLs.
  while (await prisma.csrInitiative.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

// Public reads are the same for every visitor, so they're kept in memory
// (see lib/swr-cache.ts) instead of costing a database round trip on every
// page view. Any write to these tables clears it (see lib/prisma.ts).
const publicCache = new SwrCache({ name: "public-csr", freshMs: 30_000, maxStaleMs: 24 * 60 * 60_000, maxEntries: 200 });

/** Public: published initiatives only, Active ones first, then most recently
 * updated within each group. */
export async function getPublishedCsrInitiatives() {
  return publicCache.get("all", () => loadPublishedCsrInitiatives());
}

async function loadPublishedCsrInitiatives() {
  const initiatives = await prisma.csrInitiative.findMany({
    where: { published: true },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  // status "ACTIVE" < "COMPLETED" alphabetically, which happens to match the
  // desired order (Active first) — explicit here rather than relied upon,
  // since Prisma enum ordering follows the string, not the declaration.
  return initiatives;
}

export async function getPublishedCsrInitiativeBySlug(slug: string) {
  return publicCache.get(`slug:${slug}`, () =>
    prisma.csrInitiative.findFirst({
      where: { slug, published: true },
      include: { images: { orderBy: { displayOrder: "asc" } } },
    })
  );
}

// ---------------------------------------------------------------------------
// Admin: CRUD
// ---------------------------------------------------------------------------

const ADMIN_PAGE_SIZE = 20;

export async function getAllCsrInitiativesForAdmin({ page = 1 }: { page?: number } = {}) {
  await requireRole("ADMIN");
  const safePage = Math.max(1, page);

  const [initiatives, totalCount] = await Promise.all([
    prisma.csrInitiative.findMany({
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: { _count: { select: { donations: { where: { status: "SUCCESS" } } } } },
    }),
    prisma.csrInitiative.count(),
  ]);

  return {
    initiatives,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE)),
    page: safePage,
  };
}

export async function getCsrInitiativeForAdmin(id: string) {
  await requireRole("ADMIN");
  const initiative = await prisma.csrInitiative.findUnique({
    where: { id },
    include: { images: { orderBy: { displayOrder: "asc" } } },
  });
  if (!initiative) throw new InitiativeNotFoundError();
  return initiative;
}

/** Creates a new initiative, unpublished by default — same "draft first,
 * publish as a deliberate second step" convention as createEvent(). */
export async function createCsrInitiative(input: CreateCsrInitiativeInput, coverFile: File | null) {
  const admin = await requireRole("ADMIN");
  const data = createCsrInitiativeSchema.parse(input);
  const slug = await uniqueSlug(data.title);

  let cover: { imageUrl: string; storageKey: string } | null = null;

  const initiative = await prisma.csrInitiative.create({
    data: {
      title: data.title,
      slug,
      summary: data.summary,
      story: data.story,
      targetAmount: data.targetAmount,
      startDate: data.startDate,
      endDate: data.endDate,
      createdById: admin.id,
    },
  });

  if (coverFile && coverFile.size > 0) {
    cover = await saveCsrImage(initiative.id, coverFile);
    await prisma.csrInitiative.update({
      where: { id: initiative.id },
      data: { coverImageUrl: cover.imageUrl, coverImageStorageKey: cover.storageKey },
    });
  }

  return initiative;
}

export async function updateCsrInitiative(
  id: string,
  input: UpdateCsrInitiativeInput,
  coverFile: File | null
) {
  await requireRole("ADMIN");
  const data = updateCsrInitiativeSchema.parse(input);

  const existing = await prisma.csrInitiative.findUnique({ where: { id } });
  if (!existing) throw new InitiativeNotFoundError();

  let coverImageUrl = existing.coverImageUrl;
  let coverImageStorageKey = existing.coverImageStorageKey;

  if (coverFile && coverFile.size > 0) {
    const cover = await saveCsrImage(id, coverFile);
    if (existing.coverImageStorageKey) {
      await deleteCsrImage(existing.coverImageStorageKey).catch(() => {});
    }
    coverImageUrl = cover.imageUrl;
    coverImageStorageKey = cover.storageKey;
  }

  return prisma.csrInitiative.update({
    where: { id },
    data: {
      title: data.title,
      summary: data.summary,
      story: data.story,
      targetAmount: data.targetAmount,
      startDate: data.startDate,
      endDate: data.endDate,
      coverImageUrl,
      coverImageStorageKey,
    },
  });
}

export async function setCsrInitiativePublished(id: string, published: boolean) {
  await requireRole("ADMIN");
  const existing = await prisma.csrInitiative.findUnique({ where: { id } });
  if (!existing) throw new InitiativeNotFoundError();
  return prisma.csrInitiative.update({ where: { id }, data: { published } });
}

export async function setCsrInitiativeStatus(id: string, status: CsrInitiativeStatus) {
  await requireRole("ADMIN");
  const existing = await prisma.csrInitiative.findUnique({ where: { id } });
  if (!existing) throw new InitiativeNotFoundError();
  return prisma.csrInitiative.update({ where: { id }, data: { status } });
}

// ---------------------------------------------------------------------------
// Admin: gallery images (cover photo is set via create/updateCsrInitiative
// above; these are the additional gallery photos)
// ---------------------------------------------------------------------------

export async function addCsrInitiativeImage(initiativeId: string, file: File) {
  await requireRole("ADMIN");
  const initiative = await prisma.csrInitiative.findUnique({ where: { id: initiativeId } });
  if (!initiative) throw new InitiativeNotFoundError();

  const existingCount = await prisma.csrInitiativeImage.count({ where: { initiativeId } });
  if (existingCount >= MAX_IMAGES_PER_CSR_INITIATIVE) {
    throw new InvalidImageError(`An initiative can have at most ${MAX_IMAGES_PER_CSR_INITIATIVE} gallery photos.`);
  }

  const { imageUrl, storageKey } = await saveCsrImage(initiativeId, file);

  return prisma.csrInitiativeImage.create({
    data: { initiativeId, imageUrl, storageKey, displayOrder: existingCount },
  });
}

export async function removeCsrInitiativeImage(initiativeId: string, imageId: string) {
  await requireRole("ADMIN");
  const image = await prisma.csrInitiativeImage.findFirst({ where: { id: imageId, initiativeId } });
  if (!image) throw new AuthorizationError("Image not found on this initiative.");

  await deleteCsrImage(image.storageKey ?? "");
  await prisma.csrInitiativeImage.delete({ where: { id: image.id } });
}

// ---------------------------------------------------------------------------
// Admin: donation records
// ---------------------------------------------------------------------------

/** View-only, per initiative — donation records + totals (spec: "View
 * donation records and totals"). Never an editing surface: the only way a
 * donation's status changes is the webhook/dev-simulate callback path. */
export async function getCsrDonationsForAdmin(initiativeId: string) {
  await requireRole("ADMIN");

  const [initiative, donations] = await Promise.all([
    prisma.csrInitiative.findUnique({ where: { id: initiativeId } }),
    prisma.csrDonation.findMany({ where: { initiativeId }, orderBy: { initiatedAt: "desc" } }),
  ]);
  if (!initiative) throw new InitiativeNotFoundError();

  const successfulDonations = donations.filter((d) => d.status === "SUCCESS");
  const totalRaised = successfulDonations.reduce((sum, d) => sum + Number(d.amount), 0);

  return { initiative, donations, totalRaised, donationCount: successfulDonations.length };
}

// ---------------------------------------------------------------------------
// Public: donations
// ---------------------------------------------------------------------------

/** Visitor starts a donation to a published, ACTIVE initiative — no account
 * required. Creates a PENDING CsrDonation, then triggers the M-Pesa STK
 * push against the site's one shared Till (see mpesa.ts — every payment
 * surface on the site pays into the same MPESA_TILL_NUMBER; this
 * CsrDonation row, not a separate Till, is what identifies the payment as
 * a donation). The donation only becomes SUCCESS when
 * handleCsrDonationCallback() below receives a matching successful
 * callback — never as a side effect of this function returning without
 * error. */
export async function initiateCsrDonation(input: DonateToCsrInitiativeInput) {
  const data = donateToCsrInitiativeSchema.parse(input);
  const phone = normalizeKenyanPhone(data.donorPhone);

  // Rate-limited by phone number (no account/session to key off, since
  // donors are anonymous) — bounds both STK-push spam toward one phone and
  // PENDING-row spam from a stuck/retried client.
  checkRateLimit(`csr-donate:${phone}`, { max: 10, windowMs: 60 * 60 * 1000 });

  const initiative = await prisma.csrInitiative.findUnique({ where: { id: data.initiativeId } });
  if (!initiative) throw new InitiativeNotFoundError();
  if (!initiative.published || initiative.status !== "ACTIVE") {
    throw new InitiativeNotAcceptingDonationsError();
  }

  const donation = await prisma.csrDonation.create({
    data: {
      initiativeId: initiative.id,
      donorName: data.donorName || null,
      donorEmail: data.donorEmail || null,
      donorPhone: phone,
      amount: data.amount,
      currency: initiative.currency,
      status: "PENDING",
    },
  });

  try {
    let checkoutRequestId: string;

    if (isMpesaConfigured()) {
      const result = await initiateStkPush({
        phone,
        amount: data.amount,
        accountReference: initiative.slug.slice(0, 12) || "CSR",
        transactionDesc: "CSR donation",
      });
      checkoutRequestId = result.checkoutRequestId;
    } else if (process.env.NODE_ENV !== "production") {
      // DEV/TEST ONLY. MPESA_TILL_NUMBER isn't available yet, so a real
      // STK push can't be sent — this synthesizes a request id so the
      // PENDING -> (devSimulateCsrDonationCallback) -> SUCCESS path is
      // fully testable now, same pattern as startFeatureSubscription's dev
      // fallback. Hard-blocked in production regardless of this branch.
      checkoutRequestId = `dev-${crypto.randomUUID()}`;
    } else {
      throw new MpesaNotConfiguredError();
    }

    await prisma.csrDonation.update({
      where: { id: donation.id },
      data: { providerTransactionId: checkoutRequestId },
    });
  } catch (error) {
    await prisma.csrDonation.update({
      where: { id: donation.id },
      data: { status: "FAILED", completedAt: new Date() },
    });
    throw error;
  }

  return { donationId: donation.id };
}

/**
 * Idempotent M-Pesa callback handler for CSR donations — mirrors
 * handleMpesaCallback() in featured-service.ts exactly, including its
 * idempotency guarantee (a second callback for the same CheckoutRequestID
 * finds the row already non-PENDING and no-ops). This is the ONLY place
 * CsrInitiative.amountRaised is ever incremented, and it happens atomically
 * with the donation's own status update.
 */
export async function handleCsrDonationCallback(callback: MpesaStkCallback) {
  const donation = await prisma.csrDonation.findUnique({
    where: { providerTransactionId: callback.CheckoutRequestID },
  });

  if (!donation) {
    return { matched: false as const };
  }

  if (donation.status !== "PENDING") {
    return { matched: true as const, alreadyProcessed: true as const };
  }

  const metadata = callback as unknown as Prisma.InputJsonValue;
  const isSuccess = callback.ResultCode === 0;

  if (isSuccess) {
    await prisma.$transaction([
      prisma.csrDonation.update({
        where: { id: donation.id },
        data: { status: "SUCCESS", completedAt: new Date(), metadata },
      }),
      prisma.csrInitiative.update({
        where: { id: donation.initiativeId },
        data: { amountRaised: { increment: donation.amount } },
      }),
    ]);
  } else {
    await prisma.csrDonation.update({
      where: { id: donation.id },
      data: { status: "FAILED", completedAt: new Date(), metadata },
    });
  }

  return { matched: true as const, success: isSuccess };
}

export function extractCsrDonationReceipt(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = callbackMetadataValue(metadata as MpesaStkCallback, "MpesaReceiptNumber");
  return value === undefined ? undefined : String(value);
}

/**
 * DEV/TEST ONLY. Exercises the full donation activation path
 * (initiateCsrDonation() -> this -> handleCsrDonationCallback() ->
 * amountRaised incremented) before MPESA_TILL_NUMBER is configured.
 * Calls the exact same handleCsrDonationCallback() the real webhook calls.
 *
 * Unlike devSimulateMpesaCallback() (featured-service.ts), this can't check
 * "does the caller own this payment" — donations have no account/session to
 * check against, by design (spec: visitors donate without an account). The
 * donationId itself (a random cuid, never enumerable/listed publicly) is
 * the only thing gating this, which is an acceptable bound for a dev-only
 * tool that is hard-blocked outside development regardless.
 */
export async function devSimulateCsrDonationCallback(donationId: string, outcome: "success" | "failure") {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Payment simulation is not available in production.");
  }

  const donation = await prisma.csrDonation.findUnique({ where: { id: donationId } });
  if (!donation) throw new InitiativeNotFoundError();
  if (!donation.providerTransactionId) {
    throw new Error("This donation never reached the M-Pesa request stage.");
  }

  const callback: MpesaStkCallback = {
    MerchantRequestID: "dev-simulated",
    CheckoutRequestID: donation.providerTransactionId,
    ResultCode: outcome === "success" ? 0 : 1032,
    ResultDesc:
      outcome === "success"
        ? "The service request is processed successfully."
        : "Request cancelled by user.",
    ...(outcome === "success"
      ? {
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: Number(donation.amount) },
              { Name: "MpesaReceiptNumber", Value: `DEV${Date.now().toString().slice(-8)}` },
              { Name: "PhoneNumber", Value: 254700000000 },
            ],
          },
        }
      : {}),
  };

  return handleCsrDonationCallback(callback);
}

export { InvalidImageError };
