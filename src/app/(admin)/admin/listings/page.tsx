import Link from "next/link";
import { getAllListingsForAdmin } from "@/server/services/admin-service";
import { AdminListingRow } from "@/components/admin/AdminListingRow";
import { Pagination } from "@/components/listings/Pagination";
import type { ListingStatus } from "@prisma/client";

export const metadata = { title: "All Listings" };

const STATUSES: ListingStatus[] = ["DRAFT", "PENDING", "ACTIVE", "SOLD", "ARCHIVED"];

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status: rawStatus, page: pageParam } = await searchParams;
  const status = STATUSES.includes(rawStatus as ListingStatus) ? (rawStatus as ListingStatus) : undefined;
  const page = Math.max(1, Number(pageParam) || 1);

  const { listings, totalCount, totalPages } = await getAllListingsForAdmin({ status, page });

  function hrefFor(overrides: { status?: string; page?: number }) {
    const params = new URLSearchParams();
    const s = overrides.status !== undefined ? overrides.status : status;
    const p = overrides.page ?? 1;
    if (s) params.set("status", s);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/listings?${qs}` : "/admin/listings";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">All Listings</h1>
      <p className="mt-1 text-sm text-slate-500">{totalCount.toLocaleString()} total.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={hrefFor({ status: "" })}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            !status ? "bg-brand text-white" : "border border-slate-300 text-slate-600 hover:bg-brand-subtle"
          }`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={hrefFor({ status: s })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              status === s ? "bg-brand text-white" : "border border-slate-300 text-slate-600 hover:bg-brand-subtle"
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {listings.map((listing) => (
          <AdminListingRow key={listing.id} listing={{ ...listing, price: Number(listing.price) }} />
        ))}
        {listings.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No listings match this filter.
          </p>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} buildHref={(p) => hrefFor({ page: p })} />
    </div>
  );
}
