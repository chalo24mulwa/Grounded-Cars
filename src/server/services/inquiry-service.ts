import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthorizationError } from "@/server/authorization/ownership";
import { notify } from "@/server/services/notification-service";
import { checkRateLimit } from "@/server/services/rate-limit";
import {
  createInquirySchema,
  updateInquiryStatusSchema,
  type CreateInquiryInput,
} from "@/server/validation/inquiry-schema";
import type { InquiryStatus } from "@prisma/client";

// ----------------------------------------------------------------------------
// Inquiries — the ONLY module that writes to Inquiry. Same conventions as
// listing-service.ts: thin actions call these, ownership/authorization
// lives here, never trusts client-supplied identity fields.
// ----------------------------------------------------------------------------

export class ListingNotAvailableError extends Error {
  constructor() {
    super("This vehicle is no longer available for inquiries.");
    this.name = "ListingNotAvailableError";
  }
}

export class ListingNotFoundError extends Error {
  constructor() {
    super("Listing not found.");
    this.name = "ListingNotFoundError";
  }
}

export class DuplicateInquiryError extends Error {
  constructor() {
    super("You already have an open inquiry for this vehicle — the seller has been notified.");
    this.name = "DuplicateInquiryError";
  }
}

const UNANSWERED_STATUSES: InquiryStatus[] = ["NEW", "READ"];
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Creates an inquiry. Every identity field is server-derived — the only
 * user input that reaches the database is `message`:
 *   - buyerUserId / name / email / phone: the authenticated session's own
 *     account, re-fetched from the DB (never a client-submitted value).
 *   - sellerId: read off the listing itself, fresh from the DB — this is
 *     the literal "seller ID determined securely from the listing on the
 *     server, not trusted from the browser" requirement.
 */
export async function createInquiry(input: CreateInquiryInput) {
  const sessionUser = await requireAuth();

  // Rate limit first — cheap, and avoids doing any DB work at all for an
  // obviously-abusive burst of submissions.
  checkRateLimit(`inquiry:${sessionUser.id}`, { max: 5, windowMs: 15 * 60 * 1000 });

  const data = createInquirySchema.parse(input);

  const listing = await prisma.carListing.findUnique({ where: { id: data.listingId } });
  if (!listing) throw new ListingNotFoundError();
  if (listing.status !== "ACTIVE") throw new ListingNotAvailableError();

  const existingOpenInquiry = await prisma.inquiry.findFirst({
    where: {
      listingId: listing.id,
      buyerUserId: sessionUser.id,
      status: { in: UNANSWERED_STATUSES },
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
  });
  if (existingOpenInquiry) throw new DuplicateInquiryError();

  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });

  const inquiry = await prisma.inquiry.create({
    data: {
      listingId: listing.id,
      buyerUserId: buyer.id,
      sellerId: listing.sellerId,
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
      message: data.message,
    },
  });

  await notify({
    userId: listing.sellerId,
    type: "INQUIRY_RECEIVED",
    vars: { listingTitle: listing.title },
    relatedEntityType: "Inquiry",
    relatedEntityId: inquiry.id,
    payload: { inquiryId: inquiry.id, listingId: listing.id },
  });

  return inquiry;
}

/** Seller's own received inquiries (ADMIN sees all, for moderation —
 * consistent with the ADMIN bypass pattern in ownership.ts). */
export async function getMyReceivedInquiries() {
  const user = await requireAuth();
  if (user.role !== "SELLER" && user.role !== "ADMIN" && user.role !== "MODERATOR") {
    throw new AuthorizationError("Only sellers can view received inquiries.");
  }

  return prisma.inquiry.findMany({
    where: user.role === "ADMIN" ? {} : { sellerId: user.id },
    include: {
      listing: { select: { id: true, title: true, slug: true, status: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

/** Ownership-checked status update — the only way an inquiry's status
 * changes. Re-fetches the inquiry fresh rather than trusting a
 * client-supplied sellerId, same pattern as requireListingOwnership. */
export async function updateInquiryStatus(inquiryId: string, status: InquiryStatus) {
  const user = await requireAuth();
  const { status: validStatus } = updateInquiryStatusSchema.parse({ status });

  const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
  if (!inquiry) throw new AuthorizationError("Inquiry not found.");
  if (inquiry.sellerId !== user.id && user.role !== "ADMIN") {
    throw new AuthorizationError("You do not have access to this inquiry.");
  }

  const updated = await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: validStatus },
  });

  if (validStatus === "REPLIED" && inquiry.buyerUserId) {
    const listing = await prisma.carListing.findUnique({
      where: { id: inquiry.listingId },
      select: { title: true, slug: true },
    });
    await notify({
      userId: inquiry.buyerUserId,
      type: "INQUIRY_REPLIED",
      vars: { listingTitle: listing?.title ?? "", listingSlug: listing?.slug ?? "" },
      relatedEntityType: "Inquiry",
      relatedEntityId: inquiry.id,
      payload: { inquiryId: inquiry.id, listingId: inquiry.listingId },
    });
  }

  return updated;
}
