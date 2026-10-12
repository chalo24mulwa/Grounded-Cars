"use client";

import { useState, useTransition } from "react";
import { UploadedImage } from "@/components/ui/UploadedImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { approveListingAction, rejectListingAction } from "@/server/actions/admin-actions";

type PendingListing = {
  id: string;
  slug: string;
  title: string;
  make: string;
  model: string;
  year: number;
  // Prisma's Decimal can't cross the Server→Client boundary as a prop — the
  // caller converts with Number(listing.price) before passing this in.
  price: number;
  currency: string;
  updatedAt: Date;
  images: { imageUrl: string; altText: string | null }[];
  seller: { id: string; name: string; email: string };
};

export function PendingListingRow({
  listing,
  showDetailsLink = true,
}: {
  listing: PendingListing;
  // Off for the MODERATOR review queue — "Review details" opens the
  // seller's own edit page, which requireListingOwnership only bypasses
  // for ADMIN (a MODERATOR reviewing another seller's listing doesn't get
  // edit access to it, by design — see requireListingModerationAccess).
  // The card's own photo/title/price/seller info is what a MODERATOR
  // reviews from instead.
  showDetailsLink?: boolean;
}) {
  const cover = listing.images[0];
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submitReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectListingAction(listing.id, reason);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {cover ? (
          <UploadedImage
            src={cover.imageUrl}
            alt={cover.altText ?? listing.title}
            fill
            className="object-cover"
            sizes="112px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No photo
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{listing.title}</p>
        <p className="text-sm text-slate-500">
          {listing.year} · {listing.make} {listing.model} · {listing.currency}{" "}
          {Number(listing.price).toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          Submitted by {listing.seller.name} ({listing.seller.email})
        </p>

        {!showRejectForm ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {showDetailsLink && (
              <Link
                href={`/dashboard/listings/${listing.id}/edit`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
              >
                Review details
              </Link>
            )}
            <ActionButton
              label="Approve"
              variant="primary"
              onAction={() => approveListingAction(listing.id)}
            />
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Send back for changes
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                {error}
              </p>
            )}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain what the seller needs to change (shown to them on their listing)…"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={submitReject}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Sending…" : "Confirm — send back to seller"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setShowRejectForm(false);
                  setError(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-brand-subtle"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
