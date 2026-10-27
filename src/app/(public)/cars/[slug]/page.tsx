import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import {
  getPublicListingBySlug,
  getRelatedListings,
  getMakeModelIndex,
  getPublicListings,
} from "@/server/services/listing-service";
import { getMyFavoriteListingIds } from "@/server/services/favorite-service";
import { CLASSIFICATIONS } from "@/server/validation/search-schema";
import { SoldBanner } from "@/components/ui/SoldBanner";
import { FeaturedBadge } from "@/components/ui/FeaturedBadge";
import { ClassificationBadges } from "@/components/ui/ClassificationBadges";
import { FavoriteButton } from "@/components/listings/FavoriteButton";
import { Pagination } from "@/components/listings/Pagination";
import { ShareButton } from "@/components/share/ShareButton";
import { InquiryForm } from "@/components/listings/InquiryForm";
import { CarImageGallery } from "@/components/listings/CarImageGallery";
import { CarCard } from "@/components/listings/CarCard";
import { siteConfig } from "@/config/site";

const SPEC_LABELS: Record<string, string> = {
  mileage: "Mileage",
  transmission: "Transmission",
  fuelType: "Fuel type",
  engineSize: "Engine size",
  bodyType: "Body type",
  color: "Color",
  condition: "Condition",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Image URLs are relative (/uploads/listings/...) for every real,
// seller-uploaded image, but the seed script's one dev listing uses an
// already-absolute placehold.co URL — this only prefixes when needed, so
// structured data never doubles up into a broken "http://...https://..."
// value either way.
function absoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${APP_URL}${url}`;
}

// Human-readable labels for the enum values woven into meta descriptions
// below — CVT/LPG are real acronyms (never lowercased), everything else is
// just Title Case with underscores turned into a hyphen where the enum
// itself represents a compound word (SEMI_AUTOMATIC → Semi-automatic).
const VALUE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  AUTOMATIC: "Automatic",
  CVT: "CVT",
  SEMI_AUTOMATIC: "Semi-automatic",
  PETROL: "Petrol",
  DIESEL: "Diesel",
  HYBRID: "Hybrid",
  ELECTRIC: "Electric",
  LPG: "LPG",
};
function labelFor(value: string): string {
  return VALUE_LABELS[value] ?? value;
}

// A meta description built from real listing data, truncated to a
// search-engine-friendly length — never a canned line that would be
// identical (and so useless / duplicate-flagged) across every listing.
// Weaves in mileage/transmission/fuel type when present (spec: descriptions
// should surface real spec data, not just price) without keyword-stuffing —
// each fact appears once, only when the listing actually has it.
// Only used when the listing actually has one or more classifications
// saved — never fabricated for a legacy row with an empty array (see
// schema.prisma's comment on CarListing.classifications).
const CLASSIFICATION_LABELS: Record<string, string> = {
  GROUNDED: "Grounded",
  SALVAGE: "Salvage",
  AUCTION: "Auction",
  OLD_SCHOOL: "Old School",
};
function classificationText(classifications: string[]): string {
  return classifications.map((c) => CLASSIFICATION_LABELS[c] ?? c).join(" & ");
}

function buildDescription(listing: {
  year: number;
  make: string;
  model: string;
  currency: string;
  price: unknown;
  location: string | null;
  description: string | null;
  mileage: number | null;
  transmission: string | null;
  fuelType: string | null;
  classifications: string[];
}, isSold: boolean): string {
  const priceText = `${listing.currency} ${Number(listing.price).toLocaleString()}`;
  const locationText = listing.location ? ` in ${listing.location}` : "";
  const classText = listing.classifications?.length ? ` ${classificationText(listing.classifications)}` : "";

  if (isSold) {
    // Deliberately does not say "for sale" / "available now" — a sold
    // listing must never read like a live offer in search results (spec:
    // "Do not generate misleading metadata for SOLD cars").
    return `This ${listing.year} ${listing.make} ${listing.model} has been sold${locationText}. Browse similar ${listing.make} cars for sale on ${siteConfig.name}.`;
  }

  const specParts: string[] = [];
  if (listing.mileage) specParts.push(`${listing.mileage.toLocaleString()} km`);
  if (listing.transmission) specParts.push(labelFor(listing.transmission));
  if (listing.fuelType) specParts.push(labelFor(listing.fuelType));
  const specText = specParts.length ? ` ${specParts.join(", ")}.` : "";

  const base = `${listing.year} ${listing.make} ${listing.model}${classText} for sale${locationText} — ${priceText}.${specText}`;
  const detail = listing.description?.trim();
  const combined = detail ? `${base} ${detail}` : `${base} View photos, specs, and contact the seller on ${siteConfig.name}.`;
  return combined.length > 160 ? `${combined.slice(0, 157)}...` : combined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getPublicListingBySlug(slug);
  if (!listing) {
    const classification = findMatchingClassification(slug);
    if (classification) return generateClassificationPageMetadata(classification);
    return generateMakePageMetadata(slug);
  }

  const isSold = listing.status === "SOLD";
  // Built from structured fields (make/model/year/location), not the
  // seller's own free-text `listing.title` — keeps every listing's <title>
  // in a consistent, predictable, keyword-relevant pattern search engines
  // can rely on ("Toyota Harrier 2018 for Sale in Nairobi | Grounded
  // Cars" — the "| Grounded Cars" suffix comes from the root
  // layout's own title template, not repeated here). The on-page
  // H1 is unaffected — it still shows the seller's own title as-is.
  // Only the classification the seller actually saved is ever used here —
  // never guessed from the title/description text.
  const classSuffix = listing.classifications?.length ? ` ${classificationText(listing.classifications)}` : "";
  const title = isSold
    ? `${listing.year} ${listing.make} ${listing.model} — Sold`
    : `${listing.year} ${listing.make} ${listing.model}${classSuffix} for Sale${listing.location ? ` in ${listing.location}` : " in Kenya"}`;
  const description = buildDescription(listing, isSold);
  const canonicalUrl = `${APP_URL}/cars/${listing.slug}`;
  const primaryImage = listing.images.find((img) => img.isPrimary) ?? listing.images[0];
  // The listing's own cover photo when it has one; otherwise the branded
  // share card rather than a link preview with no image at all.
  const ogImages = primaryImage
    ? [{ url: primaryImage.imageUrl, alt: primaryImage.altText ?? listing.title }]
    : [siteConfig.shareImage];

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    // A sold or otherwise non-active listing shouldn't be actively promoted
    // for indexing as if it were a live offer — still crawlable (a buyer
    // searching the exact title should still find it, and it's not private
    // data), just not encouraged into search result placement the way an
    // ACTIVE listing is.
    robots: isSold ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: siteConfig.name,
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages?.map((img) => img.url),
    },
  };
}


/** ?page=N from the URL (48 cars per page; anything invalid means page 1). */
function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

export default async function CarDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const listing = await getPublicListingBySlug(slug);
  // A listing slug always starts with a 4-digit year (see schema.prisma's
  // comment on `slug`), so it can never collide with a plain make name —
  // this is what lets /cars/toyota exist as a sibling of /cars/[slug]
  // without a routing conflict (Next.js requires every page at this same
  // path position to share one dynamic segment name, so a make page can't
  // live in its own [make] folder next to this one).
  //
  // notFound() is called directly here, in the page's own top-level
  // function body, rather than inside MakeBrowsePage itself — confirmed
  // during testing that a notFound() thrown from a plain nested async
  // component (not the route's own default export) rendered the
  // not-found UI correctly but left the HTTP status at 200 instead of
  // 404, which every real crawler/monitoring tool cares about.
  if (!listing) {
    const classification = findMatchingClassification(slug);
    if (classification) {
      return (
        <ClassificationBrowsePage
          classification={classification}
          slug={slug}
          page={parsePage((await searchParams).page)}
        />
      );
    }
    const make = await findMatchingMake(slug);
    if (!make) notFound();
    return <MakeBrowsePage make={make} slug={slug} page={parsePage((await searchParams).page)} />;
  }

  // Related vehicles are deliberately NOT awaited here — see
  // RelatedListingsSection below: the listing itself renders immediately and
  // that section streams in behind it.
  const session = await auth();
  const favoriteIds = session?.user ? await getMyFavoriteListingIds() : new Set<string>();

  const isSold = listing.status === "SOLD";
  const primaryImage = listing.images.find((img) => img.isPrimary) ?? listing.images[0];
  const otherImages = listing.images.filter((img) => img.id !== primaryImage?.id);
  // The primary photo leads the carousel; everything else follows in its
  // existing displayOrder — the query itself only orders by displayOrder
  // (not isPrimary), so this is the one place that reassembles "primary
  // first" for display, same as the old hero+strip split did implicitly.
  const galleryImages = primaryImage ? [primaryImage, ...otherImages] : listing.images;

  const specs: [string, string | number | null | undefined][] = [
    ["mileage", listing.mileage ? `${listing.mileage.toLocaleString()} km` : null],
    ["transmission", listing.transmission],
    ["fuelType", listing.fuelType],
    ["engineSize", listing.engineSize],
    ["bodyType", listing.bodyType],
    ["color", listing.color],
    ["condition", listing.condition],
  ];

  // Schema.org structured data (Vehicle + Offer) — availability is derived
  // straight from `listing.status`, the same single source of truth the
  // rest of this page uses, so a sold car can never carry an "InStock"
  // offer in search engines' eyes. Built with plain objects + JSON.stringify
  // (never manual string concatenation), which is what makes this safe to
  // populate from seller-authored free text (title, description) without a
  // JSON/script-injection risk.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: listing.title,
    brand: listing.make,
    model: listing.model,
    vehicleModelDate: String(listing.year),
    ...(listing.mileage
      ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: listing.mileage, unitCode: "KMT" } }
      : {}),
    ...(listing.fuelType ? { fuelType: listing.fuelType } : {}),
    ...(listing.transmission ? { vehicleTransmission: listing.transmission } : {}),
    ...(listing.color ? { color: listing.color } : {}),
    // Exposed as additionalProperty, not vehicleCondition — schema.org's
    // vehicleCondition enum (NewCondition/UsedCondition/DamagedCondition/
    // RefurbishedCondition) doesn't fit all four classifications (an
    // AUCTION or OLD_SCHOOL vehicle isn't necessarily damaged), so mapping
    // it there would misrepresent some listings. This way search engines
    // get the real saved classification without an inaccurate claim either
    // way, and only for listings that actually have one saved.
    ...(listing.classifications?.length
      ? {
          additionalProperty: listing.classifications.map((c) => ({
            "@type": "PropertyValue",
            name: "Classification",
            value: CLASSIFICATION_LABELS[c] ?? c,
          })),
        }
      : {}),
    image: listing.images.map((img) => absoluteUrl(img.imageUrl)),
    offers: {
      "@type": "Offer",
      priceCurrency: listing.currency,
      price: Number(listing.price),
      availability: isSold ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${APP_URL}/cars/${listing.slug}`,
    },
  };

  // Mirrors the real navigational path a visitor actually takes to reach
  // this page (Home → Cars → this make's own listing page → this listing),
  // never a fabricated hierarchy — the make link only appears once that
  // page exists for a make with real listings (see cars/[make]/page.tsx).
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Cars", item: `${APP_URL}/cars` },
      { "@type": "ListItem", position: 3, name: listing.make, item: `${APP_URL}/cars/${encodeURIComponent(listing.make.toLowerCase())}` },
      { "@type": "ListItem", position: 4, name: listing.title },
    ],
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Real, crawlable <a> links mirroring the JSON-LD breadcrumb above —
          also doubles as internal linking into the make page (spec: pages
          must be reachable through normal HTML links, not only JS). */}
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/cars" className="hover:text-brand hover:underline">
              Cars
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/cars/${encodeURIComponent(listing.make.toLowerCase())}`}
              className="hover:text-brand hover:underline"
            >
              {listing.make}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-slate-700" aria-current="page">
            {listing.title}
          </li>
        </ol>
      </nav>

      <CarImageGallery
        images={galleryImages}
        title={listing.title}
        isSold={isSold}
        overlay={<ClassificationBadges classifications={listing.classifications} />}
      />

      <div className="mt-6">
        {isSold && (
          <div className="mb-3">
            <SoldBanner />
          </div>
        )}
        {!isSold && listing.isFeatured && (
          <div className="mb-3">
            <FeaturedBadge corner={false} />
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold text-slate-900">{listing.title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <ShareButton
              variant="pill"
              target={{
                path: `/cars/${listing.slug}`,
                title: listing.title,
                subtitle: `${listing.currency} ${Number(listing.price).toLocaleString()}`,
                imageUrl: listing.images[0]?.imageUrl,
              }}
            />
            <FavoriteButton
              listingId={listing.id}
              initialFavorited={favoriteIds.has(listing.id)}
              isAuthenticated={Boolean(session?.user)}
            />
          </div>
        </div>
        <p className="mt-1 text-lg text-slate-600">
          {listing.year} · {listing.make} {listing.model}
        </p>
        <div className="mt-2">
          <ClassificationBadges classifications={listing.classifications} corner={false} />
        </div>
        <p className="mt-2 text-2xl font-bold text-brand">
          {listing.currency} {Number(listing.price).toLocaleString()}
        </p>

        {isSold && listing.soldAt && (
          <p className="mt-2 text-sm font-medium text-status-sold">
            Sold on {listing.soldAt.toLocaleDateString()}
          </p>
        )}
        {listing.location && <p className="mt-1 text-sm text-slate-500">{listing.location}</p>}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        {specs
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs text-slate-500">{SPEC_LABELS[key]}</dt>
              <dd className="font-medium text-slate-900">{value}</dd>
            </div>
          ))}
      </dl>

      {listing.description && (
        <div className="mt-6">
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Description</h2>
          <p className="whitespace-pre-line text-slate-700">{listing.description}</p>
        </div>
      )}

      {listing.seller && !isSold && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Seller</h2>
          <p className="text-sm text-slate-600">{listing.seller.name}</p>
          {listing.seller.phone && (
            <a
              href={`tel:${listing.seller.phone}`}
              className="mt-1 inline-block text-sm font-medium text-brand hover:underline"
            >
              {listing.seller.phone}
            </a>
          )}
        </div>
      )}

      {/* Inquiries are only accepted on ACTIVE listings — a SOLD car isn't
          "no longer available unless the future business rules explicitly
          permit it" (spec), so no form is offered here at all once sold;
          the SoldBanner above already communicates that clearly. */}
      {!isSold && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Contact the seller</h2>
          {session?.user ? (
            <InquiryForm listingId={listing.id} />
          ) : (
            <p className="text-sm text-slate-600">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/cars/${listing.slug}`)}`}
                className="font-medium text-brand hover:underline"
              >
                Log in
              </Link>{" "}
              to send this seller a message about the vehicle.
            </p>
          )}
        </div>
      )}

      <Suspense fallback={<RelatedListingsSkeleton />}>
        <RelatedListingsSection
          listing={listing}
          favoriteIds={favoriteIds}
          isAuthenticated={Boolean(session?.user)}
        />
      </Suspense>
    </div>
  );
}

type PublicListing = NonNullable<Awaited<ReturnType<typeof getPublicListingBySlug>>>;

// Ranked by price closeness + title/description overlap within the same
// category (see getRelatedListings in listing-service.ts) — never
// empty-but-rendered: the whole section is skipped when nothing qualifies
// (e.g. the only other listing on the site).
//
// Its own async component inside a <Suspense> boundary so the page above —
// photos, price, specs, contact form: everything the visitor came for — is
// sent as soon as the listing itself is loaded, instead of waiting for the
// several extra queries this section needs. Everything that decides whether
// the page exists (the listing lookup and its notFound()) happens before
// this, so the HTTP status is unaffected.
async function RelatedListingsSection({
  listing,
  favoriteIds,
  isAuthenticated,
}: {
  listing: PublicListing;
  favoriteIds: Set<string>;
  isAuthenticated: boolean;
}) {
  const relatedListings = await getRelatedListings(listing);
  if (relatedListings.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Other Related Vehicles</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-6">
        {relatedListings.map((related) => (
          <CarCard
            key={related.id}
            listing={related}
            isFavorited={favoriteIds.has(related.id)}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </div>
    </div>
  );
}

function RelatedListingsSkeleton() {
  return (
    <div className="mt-8" aria-hidden="true">
      <div className="mb-3 h-6 w-56 animate-pulse rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-2.5 sm:gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="aspect-[3/2] w-full animate-pulse bg-slate-200 sm:aspect-[4/3]" />
            <div className="space-y-2 p-2 sm:p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Make landing pages (/cars/toyota, /cars/mazda, …) — a sibling of the
// listing-detail view above sharing this same [slug] route (see the
// comment where this is invoked for why they can't live in their own
// [make] folder). Only ever renders for a make that actually has current
// public listings — matched against getMakeModelIndex() (never a fixed,
// hardcoded make list), which is what keeps this from becoming a
// thousands-of-thin-pages generator: no Mazda listings today means no
// working /cars/mazda page today.
// ----------------------------------------------------------------------------

async function findMatchingMake(param: string): Promise<string | null> {
  const index = await getMakeModelIndex();
  const decoded = decodeURIComponent(param).toLowerCase();
  return index.find((m) => m.make.toLowerCase() === decoded)?.make ?? null;
}

async function generateMakePageMetadata(param: string): Promise<Metadata> {
  const make = await findMatchingMake(param);
  if (!make) return {};

  const title = `${make} Cars for Sale in Kenya | ${siteConfig.name}`;
  return {
    title: { absolute: title },
    description: `Browse ${make} cars for sale in Kenya — locally used vehicles and fresh import ${make} imports from verified sellers and dealers on ${siteConfig.name}.`,
    alternates: { canonical: `${APP_URL}/cars/${encodeURIComponent(param.toLowerCase())}` },
  };
}

async function MakeBrowsePage({ make, slug, page: requestedPage }: { make: string; slug: string; page: number }) {
  const session = await auth();
  const [{ listings, totalCount, page, totalPages }, favoriteIds] = await Promise.all([
    getPublicListings({ make, page: requestedPage }),
    session?.user ? getMyFavoriteListingIds() : Promise.resolve(new Set<string>()),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Cars", item: `${APP_URL}/cars` },
      { "@type": "ListItem", position: 3, name: `${make} Cars for Sale` },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- static breadcrumb data only
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/cars" className="hover:text-brand hover:underline">
              Cars
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-slate-700" aria-current="page">
            {make}
          </li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{make} Cars for Sale in Kenya</h1>
      <p className="mt-1 text-sm text-slate-600">
        {totalCount.toLocaleString()} verified {totalCount === 1 ? "listing" : "listings"} right now.
      </p>

      {listings.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="font-medium text-slate-700">No {make} vehicles currently listed.</p>
          <Link href="/cars" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
            Browse all vehicles →
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <CarCard
              key={listing.id}
              listing={listing}
              isFavorited={favoriteIds.has(listing.id)}
              isAuthenticated={Boolean(session?.user)}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => (p === 1 ? `/cars/${encodeURIComponent(slug)}` : `/cars/${encodeURIComponent(slug)}?page=${p}`)}
      />

      <p className="mt-8 text-sm text-slate-500">
        Looking for a different make?{" "}
        <Link href="/cars" className="font-medium text-brand hover:underline">
          Browse all vehicles across Kenya
        </Link>
        .
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Classification landing pages (/cars/grounded, /cars/salvage, /cars/auction,
// /cars/old-school) — a second sibling of the listing-detail view, sharing
// this same [slug] route for the same reason the make pages above do. Unlike
// make pages, the four classification slugs are a fixed, known set (the
// VehicleClassification enum), not data-driven — so every classification
// always has a working URL, even with zero matching listings today, the same
// way /cars itself does. Checked before the make lookup in both call sites
// above since a real car make will never collide with one of these four
// fixed words.
// ----------------------------------------------------------------------------

type Classification = (typeof CLASSIFICATIONS)[number];

const CLASSIFICATION_SLUGS: Record<string, Classification> = {
  grounded: "GROUNDED",
  salvage: "SALVAGE",
  auction: "AUCTION",
  "old-school": "OLD_SCHOOL",
};

function findMatchingClassification(param: string): Classification | null {
  return CLASSIFICATION_SLUGS[decodeURIComponent(param).toLowerCase()] ?? null;
}

async function generateClassificationPageMetadata(classification: Classification): Promise<Metadata> {
  const label = CLASSIFICATION_LABELS[classification] ?? classification;
  const title = `${label} Cars in Kenya | ${siteConfig.name}`;
  const canonicalUrl = `${APP_URL}/cars/${classificationSlug(classification)}`;
  return {
    title: { absolute: title },
    description: `Browse ${label.toLowerCase()} cars for sale in Kenya on ${siteConfig.name} — connect directly with sellers, or buy a ${label.toLowerCase()} vehicle straight from Grounded Cars.`,
    alternates: { canonical: canonicalUrl },
  };
}

function classificationSlug(classification: string): string {
  return Object.entries(CLASSIFICATION_SLUGS).find(([, value]) => value === classification)?.[0] ?? classification.toLowerCase();
}

async function ClassificationBrowsePage({
  classification,
  slug,
  page: requestedPage,
}: {
  classification: Classification;
  slug: string;
  page: number;
}) {
  const session = await auth();
  const label = CLASSIFICATION_LABELS[classification] ?? classification;
  const [{ listings, totalCount, page, totalPages }, favoriteIds] = await Promise.all([
    getPublicListings({ classifications: [classification], page: requestedPage }),
    session?.user ? getMyFavoriteListingIds() : Promise.resolve(new Set<string>()),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Cars", item: `${APP_URL}/cars` },
      { "@type": "ListItem", position: 3, name: `${label} Cars` },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- static breadcrumb data only
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/cars" className="hover:text-brand hover:underline">
              Cars
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-slate-700" aria-current="page">
            {label}
          </li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{label} Cars in Kenya</h1>
      <p className="mt-1 text-sm text-slate-600">
        {totalCount.toLocaleString()} verified {totalCount === 1 ? "listing" : "listings"} right now.
      </p>

      {listings.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="font-medium text-slate-700">No {label.toLowerCase()} vehicles currently listed.</p>
          <Link href="/cars" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
            Browse all vehicles →
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <CarCard
              key={listing.id}
              listing={listing}
              isFavorited={favoriteIds.has(listing.id)}
              isAuthenticated={Boolean(session?.user)}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => (p === 1 ? `/cars/${encodeURIComponent(slug)}` : `/cars/${encodeURIComponent(slug)}?page=${p}`)}
      />

      <p className="mt-8 text-sm text-slate-500">
        Looking for a different category?{" "}
        <Link href="/cars" className="font-medium text-brand hover:underline">
          Browse all vehicles across Kenya
        </Link>
        .
      </p>
    </div>
  );
}
