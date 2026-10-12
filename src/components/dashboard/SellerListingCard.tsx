"use client";

import { UploadedImage } from "@/components/ui/UploadedImage";
import Link from "next/link";
import type { CarListing, CarImage } from "@prisma/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { ConfirmActionButton } from "@/components/dashboard/ConfirmActionButton";
import {
  markAsSoldAction,
  restoreToActiveAction,
  submitForReviewAction,
  archiveListingAction,
  restoreToDraftAction,
} from "@/server/actions/listing-actions";

type Listing = Pick<
  CarListing,
  "id" | "slug" | "title" | "make" | "model" | "year" | "currency" | "status"
> & {
  // Prisma's Decimal can't cross the Server→Client boundary as a prop — the
  // caller converts with Number(listing.price) before passing this in.
  price: number;
  // Pre-formatted server-side (not a raw Date formatted here) — this is a
  // Client Component, so toLocaleDateString() would run again during
  // hydration and could disagree with the server's locale/timezone,
  // producing a hydration mismatch. Formatting once, server-side, avoids
  // that entirely.
  listedDate: string;
  images: Pick<CarImage, "imageUrl" | "altText" | "isPrimary">[];
};

export function SellerListingCard({ listing }: { listing: Listing }) {
  const primaryImage = listing.images.find((i) => i.isPrimary) ?? listing.images[0];

  return (
    <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {primaryImage ? (
          <UploadedImage
            src={primaryImage.imageUrl}
            alt={primaryImage.altText ?? listing.title}
            fill
            className="object-cover"
            sizes="128px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No photo
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{listing.title}</p>
            <p className="text-sm text-slate-500">
              {listing.year} · {listing.make} {listing.model}
            </p>
          </div>
          <StatusBadge status={listing.status} />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-bold text-brand">
            {listing.currency} {Number(listing.price).toLocaleString()}
          </span>
          <span className="text-xs text-slate-400">Listed {listing.listedDate}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(listing.status === "ACTIVE" || listing.status === "SOLD") && (
            <Link
              href={`/cars/${listing.slug}`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
            >
              View
            </Link>
          )}
          <Link
            href={`/dashboard/listings/${listing.id}/edit`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
          >
            Edit
          </Link>

          {listing.status === "DRAFT" && (
            <>
              <ActionButton
                label="Submit for review"
                variant="primary"
                onAction={() => submitForReviewAction(listing.id)}
              />
              <ActionButton label="Archive" onAction={() => archiveListingAction(listing.id)} />
            </>
          )}

          {listing.status === "PENDING" && (
            <span className="self-center text-xs text-status-pending">
              Awaiting admin approval
            </span>
          )}

          {listing.status === "ACTIVE" && (
            <>
              <ConfirmActionButton
                label="Mark as Sold"
                confirmTitle="Has this vehicle been sold?"
                confirmMessage="Once marked as sold, buyers will clearly see that it's no longer available. You can restore it later if the sale is cancelled."
                confirmLabel="Yes, mark as sold"
                onAction={() => markAsSoldAction(listing.id)}
              />
              <ActionButton label="Archive" onAction={() => archiveListingAction(listing.id)} />
              <Link
                href={`/dashboard/featured?listingId=${listing.id}`}
                className="rounded-md border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
              >
                ★ Feature this car
              </Link>
            </>
          )}

          {listing.status === "SOLD" && (
            <ConfirmActionButton
              label="Restore to Active"
              confirmTitle="Restore this listing to active?"
              confirmMessage="This vehicle will be marked available again and shown to buyers. Use this only if the sale fell through."
              confirmLabel="Yes, restore listing"
              variant="outline"
              onAction={() => restoreToActiveAction(listing.id)}
            />
          )}

          {listing.status === "ARCHIVED" && (
            <ActionButton
              label="Move to Draft"
              variant="primary"
              onAction={() => restoreToDraftAction(listing.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
