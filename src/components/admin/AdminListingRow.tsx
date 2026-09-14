"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { archiveListingByAdminAction } from "@/server/actions/admin-actions";
import type { ListingStatus } from "@prisma/client";

type AdminListing = {
  id: string;
  slug: string;
  title: string;
  status: ListingStatus;
  price: number; // pre-converted from Decimal by the caller
  currency: string;
  year: number;
  updatedAt: Date;
  images: { imageUrl: string; altText: string | null }[];
  seller: { id: string; name: string; email: string };
};

export function AdminListingRow({ listing }: { listing: AdminListing }) {
  const cover = listing.images[0];
  const [showArchiveForm, setShowArchiveForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submitArchive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveListingByAdminAction(listing.id, reason);
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
          <Image
            src={cover.imageUrl}
            alt={cover.altText ?? listing.title}
            fill
            unoptimized
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{listing.title}</p>
            <p className="text-sm text-slate-500">
              {listing.year} · {listing.currency} {listing.price.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {listing.seller.name} ({listing.seller.email})
            </p>
          </div>
          <StatusBadge status={listing.status} />
        </div>

        {!showArchiveForm ? (
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
              Review / Edit
            </Link>
            {listing.status === "ACTIVE" && (
              <button
                type="button"
                onClick={() => setShowArchiveForm(true)}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Archive (inappropriate)
              </button>
            )}
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
              placeholder="Reason for archiving this listing (kept on the audit record)…"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={submitArchive}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Archiving…" : "Confirm archive"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setShowArchiveForm(false);
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
