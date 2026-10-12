import Link from "next/link";
import clsx from "clsx";
import { SoldRibbon } from "@/components/ui/SoldRibbon";
import { FeaturedBadge } from "@/components/ui/FeaturedBadge";
import { ImportStatusBadge } from "@/components/ui/ImportStatusBadge";
import { FavoriteButton } from "@/components/listings/FavoriteButton";
import { CarCardImageCarousel } from "@/components/listings/CarCardImageCarousel";
import { CardLinkPending } from "@/components/listings/CardLinkPending";
import type { CarListing, CarImage, ListingStatus } from "@prisma/client";

type CarCardProps = {
  listing: Pick<
    CarListing,
    | "id"
    | "slug"
    | "title"
    | "make"
    | "model"
    | "year"
    | "price"
    | "currency"
    | "status"
    | "location"
    | "importStatus"
  > & {
    images: Pick<CarImage, "imageUrl" | "altText">[];
    // Computed live by the caller (getPublicListings) from
    // FeaturedSubscription — never a stored/editable field.
    isFeatured?: boolean;
  };
  // Both provided by the page (one auth() + one favorites lookup per page,
  // not per card) — see getMyFavoriteListingIds() in favorite-service.ts.
  isFavorited?: boolean;
  isAuthenticated?: boolean;
  /** First visible row of a grid: fetch the cover photo right away (it's
   * usually the page's largest element) instead of lazily. */
  priority?: boolean;
};

export function CarCard({ listing, isFavorited = false, isAuthenticated = false, priority = false }: CarCardProps) {
  const isSold = listing.status === "SOLD" as ListingStatus;

  return (
    <Link
      href={`/cars/${listing.slug}`}
      className={clsx(
        "group relative block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md",
        isSold && "opacity-90"
      )}
    >
      <CarCardImageCarousel images={listing.images} title={listing.title} isSold={isSold} priority={priority}>
        {isSold && <SoldRibbon />}
        {!isSold && listing.isFeatured && <FeaturedBadge />}
        <ImportStatusBadge status={listing.importStatus} />
        <div className="absolute bottom-2 right-2 z-10 max-sm:bottom-1.5 max-sm:right-1.5 max-sm:[&>button]:h-7 max-sm:[&>button]:w-7">
          <FavoriteButton
            listingId={listing.id}
            initialFavorited={isFavorited}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </CarCardImageCarousel>

      <div className="space-y-1 p-4 max-sm:space-y-0.5 max-sm:px-2 max-sm:pb-2 max-sm:pt-1.5">
        <h3 className="truncate font-semibold text-slate-900 max-sm:text-[13px] max-sm:leading-snug">{listing.title}</h3>
        <p className="text-sm text-slate-500 max-sm:truncate max-sm:text-[11px] max-sm:leading-tight">
          {listing.year} · {listing.make} {listing.model}
        </p>
        <p className="font-bold text-brand max-sm:text-sm max-sm:leading-tight">
          {listing.currency} {Number(listing.price).toLocaleString()}
        </p>
        {listing.location && <p className="text-xs text-slate-400 max-sm:truncate max-sm:text-[11px] max-sm:leading-tight">{listing.location}</p>}
      </div>

      <CardLinkPending />
    </Link>
  );
}
