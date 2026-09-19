import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  requireListingOwnership,
  requireListingModerationAccess,
  requireRole,
  AuthorizationError,
} from "@/server/authorization/ownership";
import { assertValidTransition } from "@/server/services/listing-status";
import {
  createListingSchema,
  updateListingSchema,
  type CreateListingInput,
  type UpdateListingInput,
} from "@/server/validation/listing-schema";
import type { ListingSearchParams } from "@/server/validation/search-schema";
import { VEHICLE_CATEGORIES } from "@/server/validation/search-schema";
import type { ListingStatus, Prisma, VehicleCategory } from "@prisma/client";
import { slugify } from "@/lib/slugify";
import {
  saveListingImage,
  saveListingImages,
  deleteListingImage,
  deleteListingFiles,
  MAX_IMAGES_PER_LISTING,
  InvalidImageError,
} from "@/lib/storage";
import { notify } from "@/server/services/notification-service";
import { checkRateLimit } from "@/server/services/rate-limit";
import { SwrCache, invalidateAllSwrCaches } from "@/lib/swr-cache";

// Whether SOLD listings stay visible on the public marketplace. Reserved as
// a constant (rather than hardcoding the condition inline at every call
// site) so it's a one-line change to instead read this from the
// `MarketplaceSetting` key/value table Phase 1 already modeled for exactly
// this kind of admin-tunable config — no schema change needed to make that
// switch later, only this function body.
const SHOW_SOLD_LISTINGS_PUBLICLY = true;

// ----------------------------------------------------------------------------
// Listing service — the ONLY place that writes to CarListing / CarImage /
// ListingStatusHistory. Server actions and API routes should be thin
// wrappers that call these functions; they should not contain Prisma calls
// or business rules of their own.
// ----------------------------------------------------------------------------

export async function createListing(input: CreateListingInput) {
  const user = await requireRole("SELLER", "ADMIN", "MODERATOR");
  // Draft creation is free-form (no payment, no admin step before it exists)
  // — the natural place to bound "how many listings can one account create
  // per hour" against accidental or deliberate spam, same rationale as the
  // inquiry rate limit in inquiry-service.ts.
  checkRateLimit(`listing-create:${user.id}`, { max: 20, windowMs: 60 * 60 * 1000 });
  const data = createListingSchema.parse(input);

  const baseSlug = slugify(`${data.year}-${data.make}-${data.model}-${data.title}`);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;

  const listing = await prisma.carListing.create({
    data: {
      ...data,
      slug,
      sellerId: user.id,
      status: "DRAFT",
    },
  });

  await prisma.listingStatusHistory.create({
    data: {
      listingId: listing.id,
      fromStatus: null,
      toStatus: "DRAFT",
      changedById: user.id,
      note: "Listing created.",
    },
  });

  return listing;
}

export async function updateListing(listingId: string, input: UpdateListingInput) {
  const { user } = await requireListingOwnership(listingId);
  const data = updateListingSchema.parse(input);

  // Status changes go through changeListingStatus() instead, so this
  // endpoint can never be used to sneak a status change past validation.
  const { status: _ignoredStatus, ...safeData } = data as UpdateListingInput & {
    status?: never;
  };

  return prisma.carListing.update({
    where: { id: listingId },
    data: safeData,
  });
}

/**
 * Changes a listing's status through the centrally-validated transition
 * table, and records the change in ListingStatusHistory for a permanent,
 * auditable record — this is what "preserve historical record of the sale"
 * means in practice, including if a SOLD listing is later restored.
 */
export async function changeListingStatus(
  listingId: string,
  toStatus: ListingStatus,
  note?: string,
  // "owner" (default) is every existing call site, unchanged — the seller
  // (or ADMIN, via requireListingOwnership's existing bypass) acting on
  // their own listing. "moderation" is used only by approveListing/
  // rejectListing below, so a MODERATOR can act on a listing they don't
  // own without also gaining edit access to it (see
  // requireListingModerationAccess's own comment for why that's a
  // deliberately separate bypass from requireListingOwnership).
  accessMode: "owner" | "moderation" = "owner"
) {
  const { user, listing } =
    accessMode === "moderation"
      ? await requireListingModerationAccess(listingId)
      : await requireListingOwnership(listingId);

  assertValidTransition(listing.status, toStatus, user.role);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.carListing.update({
      where: { id: listingId },
      data: {
        status: toStatus,
        // soldAt is set exactly when entering SOLD, and cleared when
        // leaving it (e.g. restored to ACTIVE) — the permanent record of
        // *that* sale event lives in ListingStatusHistory regardless.
        soldAt: toStatus === "SOLD" ? new Date() : null,
      },
    });

    await tx.listingStatusHistory.create({
      data: {
        listingId,
        fromStatus: listing.status,
        toStatus,
        changedById: user.id,
        note,
      },
    });

    return result;
  });

  // The write hook in prisma.ts already cleared the public-data caches while
  // the transaction was still open; clear again now that it has actually
  // committed, so nothing that loaded in that small window can stay cached.
  invalidateAllSwrCaches();

  // Notifications are deliberately outside the transaction above — they
  // aren't part of the atomic status change, and notify() never throws, so
  // a notification/email failure can never roll back a real status change.
  // Each branch below fires on one specific edge, not on every status
  // change, matching exactly the events the Phase 8 spec lists.
  //
  // They're also deliberately NOT awaited: each one is several database
  // round trips plus sending an email, none of which the person who clicked
  // "Approve" needs to sit through — the status change they asked for is
  // already committed. This app runs as a long-lived Node process, so the
  // work simply finishes in the background after the response is sent.
  const fromStatus = listing.status;

  if (toStatus === "SOLD" && fromStatus !== "SOLD") {
    const favoriters = await prisma.favorite.findMany({
      where: { listingId },
      select: { userId: true },
    });
    void Promise.all([
      ...favoriters.map((f) =>
        notify({
          userId: f.userId,
          type: "FAVORITE_LISTING_SOLD",
          vars: { listingTitle: listing.title },
          relatedEntityType: "CarListing",
          relatedEntityId: listingId,
        })
      ),
      notify({
        userId: listing.sellerId,
        type: "LISTING_SOLD",
        vars: { listingTitle: listing.title },
        relatedEntityType: "CarListing",
        relatedEntityId: listingId,
      }),
    ]);
  } else if (fromStatus === "PENDING" && toStatus === "ACTIVE") {
    void notify({
      userId: listing.sellerId,
      type: "LISTING_APPROVED",
      vars: { listingTitle: listing.title },
      relatedEntityType: "CarListing",
      relatedEntityId: listingId,
    });
  } else if (fromStatus === "PENDING" && toStatus === "DRAFT") {
    void notify({
      userId: listing.sellerId,
      type: "LISTING_REJECTED",
      vars: { listingTitle: listing.title, reason: note ?? "" },
      relatedEntityType: "CarListing",
      relatedEntityId: listingId,
    });
  }

  return updated;
}

/** Convenience wrapper — this is the function the "Mark as SOLD" button calls. */
export async function markListingAsSold(listingId: string) {
  return changeListingStatus(listingId, "SOLD", "Marked as sold by seller.");
}

/** Convenience wrapper for restoring a sold listing back to active. */
export async function restoreListingToActive(listingId: string) {
  return changeListingStatus(listingId, "ACTIVE", "Restored to active from sold.");
}

/**
 * Seller dashboard overview stats (Phase 9 performance fix) — was
 * previously computed by calling getMyListings() (a full findMany with
 * every listing's every image included) and reducing the result in JS just
 * to get five small counts and a sum. That fetched arbitrarily more data
 * than the page needed — a groupBy + a viewCount sum is the same numbers
 * for a fraction of the query cost, and neither touches CarImage at all.
 */
export async function getSellerDashboardStats() {
  const user = await requireRole("SELLER", "ADMIN", "MODERATOR");

  const [statusCounts, viewAggregate] = await Promise.all([
    prisma.carListing.groupBy({
      by: ["status"],
      where: { sellerId: user.id },
      _count: { _all: true },
    }),
    prisma.carListing.aggregate({
      where: { sellerId: user.id },
      _sum: { viewCount: true },
    }),
  ]);

  const countFor = (status: ListingStatus) =>
    statusCounts.find((row) => row.status === status)?._count._all ?? 0;

  return {
    total: statusCounts.reduce((sum, row) => sum + row._count._all, 0),
    active: countFor("ACTIVE"),
    sold: countFor("SOLD"),
    draft: countFor("DRAFT"),
    pending: countFor("PENDING"),
    views: viewAggregate._sum.viewCount ?? 0,
  };
}

/** Fetches listings owned by the current seller, split by status for the dashboard. */
export async function getMyListings() {
  const user = await requireRole("SELLER", "ADMIN", "MODERATOR");

  const listings = await prisma.carListing.findMany({
    where: { sellerId: user.id },
    include: { images: { orderBy: { displayOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return listings;
}

function publicListingStatuses(): ListingStatus[] {
  return SHOW_SOLD_LISTINGS_PUBLICLY ? ["ACTIVE", "SOLD"] : ["ACTIVE"];
}

/** Every publicly-visible listing's slug + last-updated time, for
 * sitemap.ts — deliberately the only field set requested (no images, no
 * seller) since a sitemap entry needs nothing else. */
export async function getAllPublicListingSlugsForSitemap() {
  return prisma.carListing.findMany({
    where: { status: { in: publicListingStatuses() } },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}

/** Public listing fetch — no auth required, only ever returns non-DRAFT/
 * non-PENDING/non-ARCHIVED listings (PENDING is explicitly excluded here:
 * it means "awaiting admin approval," so it must never be publicly visible
 * until an admin moves it to ACTIVE — see listing-status.ts). Increments
 * viewCount on every fetch — deliberately simple (no dedup/session
 * tracking) for this phase; treat the count as a directional signal, not an
 * audited unique-visitor metric.
 *
 * Wrapped in React's cache() (Phase 9): the detail page's generateMetadata()
 * and the page component itself both need this same data within one
 * request, and without memoization that would mean two DB round trips AND
 * two viewCount increments per page view — cache() de-dupes both calls into
 * one, keyed by `slug`, for the lifetime of that single request only (never
 * shared across different users/requests, unlike a real cache). */
export const getPublicListingBySlug = cache(async (slug: string) => {
  const listing = await listingBySlugCache.get(slug, () => loadPublicListingBySlug(slug));
  if (!listing) return null;

  // Runs on every visit, deliberately outside the cache below it — the
  // counter must keep counting even when the listing itself is served from
  // memory. (See NON_PUBLIC_FIELDS in prisma.ts for why this doesn't clear
  // that cache.)
  prisma.carListing
    .update({ where: { id: listing.id }, data: { viewCount: { increment: 1 } } })
    .catch((error) => console.error("Failed to increment listing view count:", error));

  return listing;
});

// The database half of getPublicListingBySlug — what actually gets cached.
// A page view used to be: find the listing, load its images and seller, then
// check for a featured subscription, all one after another.
const listingBySlugCache = new SwrCache({
  name: "listing-by-slug",
  freshMs: 30_000,
  maxStaleMs: 10 * 60_000,
  maxEntries: 300,
});

async function loadPublicListingBySlug(slug: string) {
  const found = await prisma.carListing.findFirst({
    where: {
      slug,
      status: { in: publicListingStatuses() },
    },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      seller: { select: { id: true, name: true, phone: true } },
      // Fetched here, alongside images and seller (which Prisma loads in
      // parallel), only to work out isFeatured below — it used to be a
      // separate lookup made after everything else, one more full database
      // round trip on every cold listing load.
      featuredSubscriptions: {
        where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!found) return null;
  const { featuredSubscriptions, ...listing } = found;

  // Same live computation as getPublicListings() below — a listing is only
  // "featured" while it has an ACTIVE, unexpired subscription AND is
  // itself still ACTIVE (this fetch already guarantees non-SOLD-only
  // callers see the right thing, but a SOLD listing must never show the
  // Verified badge even though it can still be publicly visible).
  return { ...listing, isFeatured: listing.status === "ACTIVE" && featuredSubscriptions.length > 0 };
}

// Loads listing details ahead of time for listings that were just shown on a
// list page, so that clicking one finds it already in memory instead of
// starting a chain of database queries. Runs in the background (never awaited
// by a request) and skips anything already stored, so in steady state it does
// nothing. Two at a time: each load is several queries, and the connection
// pool is deliberately small. It only warms the cache — it never touches the
// view counter, which stays with real visits.
async function primeListingDetails(slugs: string[]): Promise<void> {
  const queue = [...slugs];
  async function worker() {
    for (let slug = queue.shift(); slug !== undefined; slug = queue.shift()) {
      await listingBySlugCache.warm(slug, () => loadPublicListingBySlug(slug));
    }
  }
  await Promise.all([worker(), worker()]);
}

const CARD_IMAGE_ORDER_BY = [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }];
// CarCard now plays through a listing's photos in place (CarCardImageGallery
// — hover arrows, dots, swipe), not just the single primary photo — capped
// well below MAX_IMAGES_PER_LISTING (12) so a page of 24 cards can't pull
// hundreds of image rows just for grid previews; the full set is still only
// ever a click away on the detail page.
const CARD_IMAGE_PREVIEW_COUNT = 6;
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;

const RELATED_STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "have", "has", "are",
  "was", "were", "car", "vehicle", "sale", "very", "good", "clean", "well",
]);

/** Lowercased, de-duplicated "meaningful" words from a listing's title +
 * description — the input to the plain word-overlap score
 * getRelatedListings() below uses as its text-similarity signal. Words of
 * 2 characters or less and a short stoplist of generic marketplace filler
 * ("car", "clean", "for sale", ...) are dropped so the score reflects
 * actual shared detail (make/model tokens, features, condition notes),
 * not words nearly every listing happens to contain. */
function significantWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(words.filter((w) => w.length > 2 && !RELATED_STOPWORDS.has(w)));
}

/** Jaccard similarity (intersection / union) of two word sets — 0 when
 * either is empty or they share nothing, 1 when identical. */
function wordOverlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * "Other Related Vehicles" for the detail page — ranked by a blend of price
 * closeness, title/description word overlap, and same-make, restricted to
 * the same category (a Lorry's "related vehicles" should be other lorries,
 * not a sedan that happens to be similarly priced). Candidate pool is
 * bounded (`take: 60`) and scored/sorted in memory rather than in SQL —
 * deliberately simple for a set this small, not a search-engine-grade
 * similarity system.
 *
 * Falls back to the same scoring across ALL public categories when the
 * listing's own category doesn't have enough other listings yet (a sparse
 * category on a young marketplace shouldn't just render an empty section).
 */
type RelatedListingSource = {
  id: string;
  category: VehicleCategory;
  make: string;
  price: Prisma.Decimal | number;
  title: string;
  description: string | null;
};

// Scoring up to 60 candidates is 3-5 sequential database round trips on every
// detail page view; the result only changes when listings change (which
// clears this cache — see prisma.ts).
const relatedListingsCache = new SwrCache({
  name: "related-listings",
  freshMs: 60_000,
  maxStaleMs: 10 * 60_000,
  maxEntries: 300,
});

export async function getRelatedListings(listing: RelatedListingSource, limit = 8) {
  return relatedListingsCache.get(`${listing.id}:${limit}`, () => loadRelatedListings(listing, limit));
}

async function loadRelatedListings(listing: RelatedListingSource, limit: number) {
  const statuses = publicListingStatuses();
  const price = Number(listing.price);
  const targetWords = significantWords(`${listing.title} ${listing.description ?? ""}`);

  async function candidatesIn(where: Prisma.CarListingWhereInput) {
    return prisma.carListing.findMany({
      where: { status: { in: statuses }, id: { not: listing.id }, ...where },
      include: { images: { orderBy: CARD_IMAGE_ORDER_BY, take: CARD_IMAGE_PREVIEW_COUNT } },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
  }

  let candidates = await candidatesIn({ category: listing.category });
  if (candidates.length < 3) {
    candidates = await candidatesIn({});
  }
  if (candidates.length === 0) return [];

  const scored = candidates.map((candidate) => {
    const priceDiffRatio = Math.abs(Number(candidate.price) - price) / Math.max(price, 1);
    const priceScore = 1 / (1 + priceDiffRatio); // 1 at identical price, decays as the gap grows
    const overlapScore = wordOverlapScore(
      targetWords,
      significantWords(`${candidate.title} ${candidate.description ?? ""}`)
    );
    const sameCategoryBonus = candidate.category === listing.category ? 0.2 : 0;
    const sameMakeBonus = candidate.make.toLowerCase() === listing.make.toLowerCase() ? 0.15 : 0;
    return {
      candidate,
      score: priceScore * 0.5 + overlapScore * 0.35 + sameCategoryBonus + sameMakeBonus,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit).map((s) => s.candidate);

  // Live isFeatured, same computation as getPublicListings/
  // getPublicListingBySlug — never a stored flag.
  const featuredRows = await prisma.featuredSubscription.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      listingId: { in: top.map((c) => c.id) },
      listing: { status: "ACTIVE" },
    },
    select: { listingId: true },
  });
  const featuredIds = new Set(featuredRows.map((r) => r.listingId));

  return top.map((c) => ({ ...c, isFeatured: featuredIds.has(c.id) }));
}

/** Translates a validated filter set into a Prisma WHERE clause. Every
 * condition here is a parameterized Prisma filter — there is no string
 * concatenation anywhere in this function, which is what actually rules out
 * SQL injection (not input sanitization, which would be the wrong layer). */
function buildListingWhere(
  filters: Partial<ListingSearchParams>,
  statuses: ListingStatus[]
): Prisma.CarListingWhereInput {
  const where: Prisma.CarListingWhereInput = { status: { in: statuses } };

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { make: { contains: filters.q, mode: "insensitive" } },
      { model: { contains: filters.q, mode: "insensitive" } },
      { location: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.make) where.make = { equals: filters.make, mode: "insensitive" };
  if (filters.model) where.model = { equals: filters.model, mode: "insensitive" };
  if (filters.minPrice != null || filters.maxPrice != null) {
    where.price = {
      ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
    };
  }
  if (filters.minYear != null || filters.maxYear != null) {
    where.year = {
      ...(filters.minYear != null ? { gte: filters.minYear } : {}),
      ...(filters.maxYear != null ? { lte: filters.maxYear } : {}),
    };
  }
  if (filters.minMileage != null || filters.maxMileage != null) {
    where.mileage = {
      ...(filters.minMileage != null ? { gte: filters.minMileage } : {}),
      ...(filters.maxMileage != null ? { lte: filters.maxMileage } : {}),
    };
  }
  if (filters.transmission) where.transmission = filters.transmission;
  if (filters.fuelType) where.fuelType = filters.fuelType;
  if (filters.bodyType) where.bodyType = { equals: filters.bodyType, mode: "insensitive" };
  if (filters.location) where.location = { contains: filters.location, mode: "insensitive" };
  if (filters.condition) where.condition = filters.condition;
  if (filters.importStatus) where.importStatus = filters.importStatus;
  if (filters.category) where.category = filters.category;

  return where;
}

/** One sort choice → one Prisma orderBy, applied identically to BOTH the
 * featured and normal groups (see getPublicListings) so an explicit sort
 * ("Price: low to high") is still honored *within* each group — only the
 * featured-group-first grouping itself is fixed, per spec: sellers pay
 * specifically for top placement, so no sort should let a normal listing
 * outrank a featured one, but within that constraint the buyer's chosen
 * order is always respected. */
function sortToOrderBy(
  sort: ListingSearchParams["sort"]
): Prisma.CarListingOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }];
    case "price_asc":
      return [{ price: "asc" }];
    case "price_desc":
      return [{ price: "desc" }];
    case "year_desc":
      return [{ year: "desc" }];
    case "mileage_asc":
      return [{ mileage: "asc" }];
    case "featured":
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

export type ListingSearchResult = Awaited<ReturnType<typeof getPublicListings>>;

/**
 * Public marketplace listing query — the single place `/cars`, the
 * homepage, and Best Deals fetch from, so search/filter/sort/pagination
 * rules live in one function instead of being duplicated per page.
 *
 * Featured-first (Phase 4/5): listings with a currently-ACTIVE, unexpired
 * FeaturedSubscription are always grouped first, normal listings after —
 * "featured" is never a stored boolean, it's the live subscription check
 * below, so an expired or since-SOLD listing can never appear in the
 * featured group regardless of what a stale flag might have said.
 *
 * Pagination is server-side and correct across the featured/normal split
 * without ever double-fetching or skipping a row: the featured set's own
 * count determines how many of a given page's slots (if any) come from the
 * featured query vs. the normal query, and each query uses a real DB-level
 * skip/take — this scales the same way regardless of how many thousands of
 * normal listings exist, because the featured set (bounded by how many
 * sellers are actively paying) is what's fetched in full, never the normal
 * set.
 */
type PublicListingFilters = Partial<ListingSearchParams> & { onlyFeatured?: boolean };

// Same for every visitor, so one visitor's load serves everyone (see
// swr-cache.ts). Free-text searches are the one thing not cached: the space of
// possible search strings is unbounded and each is typically asked once.
const publicListingsCache = new SwrCache({
  name: "public-listings",
  freshMs: 30_000,
  maxStaleMs: 10 * 60_000,
  maxEntries: 200,
});

export async function getPublicListings(filters: PublicListingFilters = {}) {
  if (filters.q) return loadPublicListings(filters);
  return publicListingsCache.get(JSON.stringify(filters), async () => {
    const result = await loadPublicListings(filters);
    // Only for the unfiltered first page (the homepage and the default /cars
    // view): those are what nearly every visit starts from, and it keeps
    // arbitrary filter combinations from each triggering a batch of
    // background loads.
    const { sort: _sort, page, ...otherFilters } = filters;
    if (Object.keys(otherFilters).length === 0 && (page ?? 1) === 1) {
      void primeListingDetails(result.listings.map((listing) => listing.slug));
    }
    return result;
  });
}

async function loadPublicListings(filters: PublicListingFilters) {
  const now = new Date();
  const statuses = publicListingStatuses();
  const where = buildListingWhere(filters, statuses);
  const orderBy = sortToOrderBy(filters.sort ?? "featured");
  const pageSize = Math.min(DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, filters.page ?? 1);

  // Featured ids matching the current filters — fetched in full (bounded by
  // paid-subscription count, not listing count) so both its total and its
  // page-slice can be computed without a second round trip. Deliberately
  // forces the related listing's status to ACTIVE regardless of `statuses`
  // (which may include SOLD) — a SOLD listing must never be treated as
  // featured even if it still has time left on its subscription, per the
  // Phase 4 rule this preserves.
  //
  // The total number of matching listings is fetched at the same time as the
  // featured ids rather than after them: every featured listing already
  // satisfies `where` (that's what the query above filters on), so "matching
  // listings that aren't featured" is simply matching minus featured. This
  // removes one full database round trip from the chain.
  const [featuredRows, totalMatching] = await Promise.all([
    prisma.featuredSubscription.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { gt: now },
        listing: { ...where, status: "ACTIVE" },
      },
      select: { listingId: true },
      distinct: ["listingId"],
    }),
    filters.onlyFeatured ? Promise.resolve(0) : prisma.carListing.count({ where }),
  ]);
  const allFeaturedIds = featuredRows.map((r) => r.listingId);

  const totalFeatured = allFeaturedIds.length;
  const totalNormal = filters.onlyFeatured ? 0 : Math.max(0, totalMatching - totalFeatured);
  const totalCount = totalFeatured + totalNormal;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const globalOffset = (page - 1) * pageSize;

  let featuredIdsForPage: string[] = [];
  let normalSkip = 0;
  let normalTake = 0;

  if (globalOffset < totalFeatured) {
    const featuredSkip = globalOffset;
    const featuredTake = Math.min(pageSize, totalFeatured - featuredSkip);
    featuredIdsForPage = allFeaturedIds.slice(featuredSkip, featuredSkip + featuredTake);
    normalSkip = 0;
    // Bug fixed during testing: this used to fall through to fetching
    // "pageSize - featuredTake" normal listings unconditionally, ignoring
    // onlyFeatured entirely — Best Deals (onlyFeatured: true) was silently
    // padding its single featured result with 23 ordinary ones.
    normalTake = filters.onlyFeatured ? 0 : Math.max(0, pageSize - featuredTake);
  } else if (!filters.onlyFeatured) {
    normalSkip = globalOffset - totalFeatured;
    normalTake = pageSize;
  }

  const [featuredListings, normalListings] = await Promise.all([
    featuredIdsForPage.length
      ? prisma.carListing.findMany({
          where: { id: { in: featuredIdsForPage }, ...where },
          include: { images: { orderBy: CARD_IMAGE_ORDER_BY, take: CARD_IMAGE_PREVIEW_COUNT } },
          orderBy,
        })
      : Promise.resolve([]),
    normalTake > 0
      ? prisma.carListing.findMany({
          where: { ...where, id: { notIn: allFeaturedIds } },
          include: { images: { orderBy: CARD_IMAGE_ORDER_BY, take: CARD_IMAGE_PREVIEW_COUNT } },
          orderBy,
          skip: normalSkip,
          take: normalTake,
        })
      : Promise.resolve([]),
  ]);

  // `id IN (...)` doesn't preserve the requested order — the query above
  // fetched the right rows, but Postgres may return them in any order, so
  // re-sort in memory using the same orderBy the normal group already got
  // from the database. Cheap: this is at most `pageSize` rows.
  const featuredIdOrder = new Map(featuredIdsForPage.map((id, i) => [id, i]));
  featuredListings.sort((a, b) => (featuredIdOrder.get(a.id) ?? 0) - (featuredIdOrder.get(b.id) ?? 0));

  const featuredIdSet = new Set(allFeaturedIds);
  const listings = [...featuredListings, ...normalListings].map((listing) => ({
    ...listing,
    isFeatured: featuredIdSet.has(listing.id),
  }));

  return { listings, page, pageSize, totalCount, totalPages };
}

/** Distinct (make → models[]) pairs among currently-public listings — backs
 * the filter sidebar's dependent Make→Model dropdown. Bounded by the number
 * of distinct make/model combinations actually listed (realistically low
 * hundreds at most for a car marketplace), never by listing count, so this
 * stays cheap regardless of how many thousands of listings exist. */
export async function getMakeModelIndex(): Promise<{ make: string; models: string[] }[]> {
  return makeModelIndexCache.get("all", loadMakeModelIndex);
}

const makeModelIndexCache = new SwrCache({
  name: "make-model-index",
  freshMs: 60_000,
  maxStaleMs: 30 * 60_000,
  maxEntries: 1,
});

async function loadMakeModelIndex(): Promise<{ make: string; models: string[] }[]> {
  const rows = await prisma.carListing.findMany({
    where: { status: { in: publicListingStatuses() } },
    select: { make: true, model: true },
    distinct: ["make", "model"],
    orderBy: [{ make: "asc" }, { model: "asc" }],
  });

  const byMake = new Map<string, string[]>();
  for (const row of rows) {
    const list = byMake.get(row.make) ?? [];
    list.push(row.model);
    byMake.set(row.make, list);
  }

  return Array.from(byMake.entries()).map(([make, models]) => ({ make, models }));
}

/** Distinct, non-empty `location` values among currently-public listings —
 * backs the /cars-for-sale/[location] landing pages' existence check and
 * sitemap inclusion (a location only ever gets a page/sitemap entry once a
 * real listing actually names it — see that page's own comment on why
 * thin, listing-free pages are deliberately never created). Same bounded-
 * by-distinct-values shape as getMakeModelIndex, not by listing count. */
export async function getDistinctLocations(): Promise<string[]> {
  const rows = await prisma.carListing.findMany({
    where: { status: { in: publicListingStatuses() }, location: { not: null } },
    select: { location: true },
    distinct: ["location"],
  });
  return rows.map((r) => r.location).filter((location): location is string => Boolean(location?.trim()));
}

// Display order + labels for the header's "Find a Car" dropdown — the one
// place these are named for a human. VEHICLE_CATEGORIES (search-schema.ts)
// is the validated set of raw enum values; this just pairs each with a
// label and, via getCategoryCounts() below, a live count.
export const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  CARS: "Cars",
  SUV_TRUCKS: "SUV & Trucks",
  LORRIES_BUSES: "Lorries and Buses",
  EV_CARS: "Electric Vehicles",
  EV_BIKES: "Electric Bikes",
};

/** Per-category listing counts for the header's "Find a Car" dropdown —
 * one groupBy, not one query per category. Every category is always
 * present in the result (defaulted to 0) so the dropdown never has to
 * guess whether a missing entry means "zero" or "not fetched yet". */
type CategoryCount = { value: VehicleCategory; label: string; count: number };

// The header runs this on literally every page, so it used to add a database
// round trip (a full groupBy) to every single page view just to draw a few
// numbers in a dropdown. A minute of staleness in those counts is invisible;
// the round trip is not. Cached in memory (see swr-cache.ts), which also
// serves the last good value if a refresh fails (a dropped database
// connection) instead of failing the whole page over a dropdown badge.
const categoryCountsCache = new SwrCache({
  name: "category-counts",
  freshMs: 60_000,
  maxStaleMs: 30 * 60_000,
  maxEntries: 1,
});

async function fetchCategoryCounts(): Promise<CategoryCount[]> {
  const rows = await prisma.carListing.groupBy({
    by: ["category"],
    where: { status: { in: publicListingStatuses() } },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((r) => [r.category, r._count._all]));

  return VEHICLE_CATEGORIES.map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
    count: counts.get(value) ?? 0,
  }));
}

export async function getCategoryCounts(): Promise<CategoryCount[]> {
  return categoryCountsCache.get("all", fetchCategoryCounts);
}

/** Ownership-checked fetch for the seller's own edit/manage-images page. */
export async function getListingForEdit(listingId: string) {
  const { listing } = await requireListingOwnership(listingId);
  return prisma.carListing.findUniqueOrThrow({
    where: { id: listing.id },
    include: { images: { orderBy: { displayOrder: "asc" } } },
  });
}

/** Seller (or admin) submits a DRAFT for admin review. */
export async function submitListingForReview(listingId: string) {
  return changeListingStatus(listingId, "PENDING", "Submitted for review.");
}

/** Seller (or admin) archives a listing — removes it from public results
 * without deleting anything; it can be resubmitted later. */
export async function archiveListing(listingId: string) {
  return changeListingStatus(listingId, "ARCHIVED", "Archived by owner.");
}

/** Seller (or admin) pulls an archived listing back to DRAFT so it can be
 * edited and resubmitted through the normal review flow. */
export async function restoreListingToDraft(listingId: string) {
  return changeListingStatus(listingId, "DRAFT", "Restored to draft from archive.");
}

/** Admin (or MODERATOR, reviewing on the admin's behalf) approves a PENDING
 * listing — the only path to ACTIVE for a listing's first publish
 * (assertValidTransition enforces ADMIN/MODERATOR-only for this specific
 * edge; see listing-status.ts). Goes through the "moderation" access mode
 * so a MODERATOR can act on a listing they don't own, without that also
 * granting them edit access to it. */
export async function approveListing(listingId: string) {
  return changeListingStatus(listingId, "ACTIVE", "Approved by admin.", "moderation");
}

/**
 * Admin (or MODERATOR) rejects a PENDING listing back to DRAFT so the
 * seller can revise and resubmit — rejection is not the same as deleting or
 * archiving the seller's work. `reason` is required (validated by the
 * caller — see rejectListingSchema in the admin action) and is stored as
 * this transition's ListingStatusHistory note, which is also exactly what
 * the seller sees on their edit page (getLatestRejectionReason below) — one
 * field, one purpose, nothing "internal" that isn't also the seller-facing
 * explanation.
 */
export async function rejectListing(listingId: string, reason: string) {
  return changeListingStatus(listingId, "DRAFT", reason, "moderation");
}

/**
 * Admin archives a listing for a policy/content reason — distinct from a
 * seller's own "Archive" (archiveListing above): same transition
 * mechanically, but the note makes clear an admin acted and why, which
 * matters for the audit trail and for a seller trying to understand what
 * happened to their listing. Valid from either PENDING or ACTIVE (both
 * already ADMIN-permitted edges to ARCHIVED — see listing-status.ts).
 */
export async function archiveListingByAdmin(listingId: string, reason: string) {
  return changeListingStatus(listingId, "ARCHIVED", `Archived by admin: ${reason}`);
}

/**
 * ADMIN-only. Permanently deletes a listing of any status belonging to any
 * seller, along with every photo/file stored for it. No reason is taken and
 * nothing is kept of the listing itself; this is the one deliberately
 * irreversible listing operation (everything else is archive/soft-state).
 *
 * The database rows go first, in one transaction, and the files only after
 * that succeeds — so a failure can never leave a listing that still exists
 * but has lost its photos. (The reverse failure, rows gone but files left
 * behind, is logged and only costs disk space.)
 *
 * Photos, status history, favorites and inquiries are removed automatically
 * by the schema's ON DELETE CASCADE. Featured subscriptions are the one thing
 * that blocks deletion (ON DELETE RESTRICT), so they're removed explicitly —
 * their PaymentTransaction rows survive with the link cleared (ON DELETE SET
 * NULL), because payment records are financial history, not listing content.
 * Notifications about this listing are removed too: they carry no foreign
 * key, and would otherwise keep pointing at a page that no longer exists.
 */
export async function deleteListingPermanently(listingId: string) {
  await requireRole("ADMIN");

  const listing = await prisma.carListing.findUnique({
    where: { id: listingId },
    select: { id: true, title: true, sellerId: true },
  });
  if (!listing) throw new AuthorizationError("Listing not found.");

  await prisma.$transaction([
    prisma.notification.deleteMany({
      where: { relatedEntityType: "CarListing", relatedEntityId: listingId },
    }),
    prisma.featuredSubscription.deleteMany({ where: { listingId } }),
    prisma.carListing.delete({ where: { id: listingId } }),
  ]);
  invalidateAllSwrCaches();

  let filesRemoved = 0;
  try {
    filesRemoved = await deleteListingFiles(listingId);
  } catch (error) {
    console.error(`Listing ${listingId} was deleted but its files could not be removed:`, error);
  }

  return { ...listing, filesRemoved };
}

/** The most recent rejection reason for a listing, if any — surfaced on
 * the seller's edit page so "the seller should understand what requires
 * correction" (spec) is a real, visible thing, not just data sitting in an
 * audit table nobody reads. Looks at ListingStatusHistory (already indexed
 * on listingId) rather than a denormalized column — one transition's note
 * *is* the rejection reason, no separate field to keep in sync. */
export async function getLatestRejectionReason(listingId: string): Promise<string | null> {
  const entry = await prisma.listingStatusHistory.findFirst({
    where: { listingId, fromStatus: "PENDING", toStatus: "DRAFT" },
    orderBy: { createdAt: "desc" },
  });
  return entry?.note ?? null;
}

/**
 * Adds one uploaded image to a listing. Each call creates exactly one
 * CarImage row for one saved file — there is no code path that can create
 * two rows from a single upload, which is what "no duplicate records on
 * retry" actually means here: a retried request just uploads (and creates)
 * a second *distinct* file, never re-inserts a row for the same save.
 */
export async function addListingImage(listingId: string, file: File) {
  const { user, listing } = await requireListingOwnership(listingId);
  checkRateLimit(`image-upload:${user.id}`, { max: 40, windowMs: 60 * 60 * 1000 });

  const existingCount = await prisma.carImage.count({ where: { listingId: listing.id } });
  if (existingCount >= MAX_IMAGES_PER_LISTING) {
    throw new InvalidImageError(`A listing can have at most ${MAX_IMAGES_PER_LISTING} photos.`);
  }

  const { imageUrl, storageKey } = await saveListingImage(listing.id, file);

  return prisma.carImage.create({
    data: {
      listingId: listing.id,
      imageUrl,
      storageKey,
      displayOrder: existingCount,
      isPrimary: existingCount === 0, // first image on a listing is primary by default
      // No UI currently collects seller-authored alt text, so this would
      // otherwise be null on every photo, site-wide — a real, meaningful
      // default (year/make/model/location, the exact facts a search engine
      // image result actually wants) costs nothing and is always accurate,
      // since it's built from the same listing row the photo belongs to.
      altText: defaultListingImageAltText(listing),
    },
  });
}

/**
 * Adds several photos to a listing in one go — same checks and result as
 * calling addListingImage() once per file, but the ownership check and photo
 * count happen once instead of per photo, the photos are processed
 * concurrently, and the rows are inserted in a single query. Order is
 * preserved (the first photo of an empty listing becomes the cover).
 * All-or-nothing: a rejected file fails the whole batch and leaves nothing
 * behind on disk or in the database.
 */
export async function addListingImages(listingId: string, files: File[]) {
  if (files.length === 0) return;

  const { user, listing } = await requireListingOwnership(listingId);
  for (let i = 0; i < files.length; i++) {
    checkRateLimit(`image-upload:${user.id}`, { max: 40, windowMs: 60 * 60 * 1000 });
  }

  const existingCount = await prisma.carImage.count({ where: { listingId: listing.id } });
  if (existingCount + files.length > MAX_IMAGES_PER_LISTING) {
    throw new InvalidImageError(`A listing can have at most ${MAX_IMAGES_PER_LISTING} photos.`);
  }

  const saved = await saveListingImages(listing.id, files);

  try {
    await prisma.carImage.createMany({
      data: saved.map((image, i) => ({
        listingId: listing.id,
        imageUrl: image.imageUrl,
        storageKey: image.storageKey,
        displayOrder: existingCount + i,
        isPrimary: existingCount + i === 0,
        altText: defaultListingImageAltText(listing),
      })),
    });
  } catch (error) {
    await Promise.all(saved.map((image) => deleteListingImage(image.storageKey)));
    throw error;
  }
}

/** "2018 Toyota Harrier for sale in Nairobi Kenya" — real listing facts
 * only, never a seller-typed string, so this can never drift from what the
 * photo actually shows. Shared by every image-adding path for this
 * listing (there's only one today, but keeping it here rather than inline
 * means a future second upload path can't forget it). */
function defaultListingImageAltText(listing: { year: number; make: string; model: string; location: string | null }): string {
  const locationText = listing.location ? ` in ${listing.location}` : "";
  return `${listing.year} ${listing.make} ${listing.model} for sale${locationText} Kenya`;
}

/** Removes one image from a listing (ownership-checked) and promotes the
 * next remaining image to primary if the removed one was primary. */
export async function removeListingImage(listingId: string, imageId: string) {
  const { listing } = await requireListingOwnership(listingId);

  const image = await prisma.carImage.findFirst({ where: { id: imageId, listingId: listing.id } });
  if (!image) {
    throw new AuthorizationError("Image not found on this listing.");
  }

  await deleteListingImage(image.storageKey ?? "");
  await prisma.carImage.delete({ where: { id: image.id } });

  if (image.isPrimary) {
    const next = await prisma.carImage.findFirst({
      where: { listingId: listing.id },
      orderBy: { displayOrder: "asc" },
    });
    if (next) {
      await prisma.carImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }
}

/** Persists a new image order (ownership-checked). `orderedImageIds` must
 * be exactly the listing's current image ids, in the desired order. */
export async function reorderListingImages(listingId: string, orderedImageIds: string[]) {
  const { listing } = await requireListingOwnership(listingId);

  const images = await prisma.carImage.findMany({ where: { listingId: listing.id } });
  const validIds = new Set(images.map((i) => i.id));
  if (
    orderedImageIds.length !== images.length ||
    !orderedImageIds.every((id) => validIds.has(id))
  ) {
    throw new AuthorizationError("Image list does not match this listing.");
  }

  await prisma.$transaction(
    orderedImageIds.map((id, index) =>
      prisma.carImage.update({ where: { id }, data: { displayOrder: index } })
    )
  );
}

/** Sets exactly one image as the listing's primary/cover image
 * (ownership-checked). */
export async function setPrimaryListingImage(listingId: string, imageId: string) {
  const { listing } = await requireListingOwnership(listingId);

  const image = await prisma.carImage.findFirst({ where: { id: imageId, listingId: listing.id } });
  if (!image) {
    throw new AuthorizationError("Image not found on this listing.");
  }

  await prisma.$transaction([
    prisma.carImage.updateMany({ where: { listingId: listing.id }, data: { isPrimary: false } }),
    prisma.carImage.update({ where: { id: image.id }, data: { isPrimary: true } }),
  ]);
}
