import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getPublicListingBySlug, getRelatedListings } from "@/server/services/listing-service";
import { getMyFavoriteListingIds } from "@/server/services/favorite-service";
import { SoldBanner } from "@/components/ui/SoldBanner";
import { FeaturedBadge } from "@/components/ui/FeaturedBadge";
import { ImportStatusBadge } from "@/components/ui/ImportStatusBadge";
import { FavoriteButton } from "@/components/listings/FavoriteButton";
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

// A meta description built from real listing data, truncated to a
// search-engine-friendly length — never a canned line that would be
// identical (and so useless / duplicate-flagged) across every listing.
function buildDescription(listing: {
  year: number;
  make: string;
  model: string;
  currency: string;
  price: unknown;
  location: string | null;
  description: string | null;
}, isSold: boolean): string {
  const priceText = `${listing.currency} ${Number(listing.price).toLocaleString()}`;
  const locationText = listing.location ? ` in ${listing.location}` : "";

  if (isSold) {
    // Deliberately does not say "for sale" / "available now" — a sold
    // listing must never read like a live offer in search results (spec:
    // "Do not generate misleading metadata for SOLD cars").
    return `This ${listing.year} ${listing.make} ${listing.model} has been sold${locationText}. Browse similar ${listing.make} cars for sale on ${siteConfig.name}.`;
  }

  const base = `${listing.year} ${listing.make} ${listing.model} for sale${locationText} — ${priceText}.`;
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
  if (!listing) return {};

  const isSold = listing.status === "SOLD";
  const title = isSold
    ? `${listing.title} — Sold`
    : `${listing.title} — ${listing.currency} ${Number(listing.price).toLocaleString()}`;
  const description = buildDescription(listing, isSold);
  const canonicalUrl = `${APP_URL}/cars/${listing.slug}`;
  const primaryImage = listing.images.find((img) => img.isPrimary) ?? listing.images[0];
  const ogImages = primaryImage
    ? [{ url: primaryImage.imageUrl, alt: primaryImage.altText ?? listing.title }]
    : undefined;

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

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getPublicListingBySlug(slug);
  if (!listing) notFound();

  const [session, relatedListings] = await Promise.all([
    auth(),
    getRelatedListings(listing),
  ]);
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
    image: listing.images.map((img) => absoluteUrl(img.imageUrl)),
    offers: {
      "@type": "Offer",
      priceCurrency: listing.currency,
      price: Number(listing.price),
      availability: isSold ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${APP_URL}/cars/${listing.slug}`,
    },
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CarImageGallery
        images={galleryImages}
        title={listing.title}
        isSold={isSold}
        overlay={<ImportStatusBadge status={listing.importStatus} />}
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
          <FavoriteButton
            listingId={listing.id}
            initialFavorited={favoriteIds.has(listing.id)}
            isAuthenticated={Boolean(session?.user)}
          />
        </div>
        <p className="mt-1 text-lg text-slate-600">
          {listing.year} · {listing.make} {listing.model}
        </p>
        <div className="mt-2">
          <ImportStatusBadge status={listing.importStatus} corner={false} />
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

      {/* Ranked by price closeness + title/description overlap within the
          same category (see getRelatedListings in listing-service.ts) —
          never empty-but-rendered: the whole section is skipped when
          nothing qualifies (e.g. the only other listing on the site). */}
      {relatedListings.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Other Related Vehicles</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {relatedListings.map((related) => (
              <CarCard
                key={related.id}
                listing={related}
                isFavorited={favoriteIds.has(related.id)}
                isAuthenticated={Boolean(session?.user)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
