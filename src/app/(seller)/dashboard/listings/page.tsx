import Link from "next/link";
import { getMyListings } from "@/server/services/listing-service";
import { SellerListingCard } from "@/components/dashboard/SellerListingCard";
import type { ListingStatus } from "@prisma/client";

export const metadata = { title: "My Cars" };

const VALID_STATUSES: ListingStatus[] = ["DRAFT", "PENDING", "ACTIVE", "SOLD", "ARCHIVED"];

export default async function MyCarsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = VALID_STATUSES.includes(status as ListingStatus) ? (status as ListingStatus) : undefined;

  // Ownership scoping (sellerId = current user) happens inside
  // getMyListings() itself — this page only applies an additional,
  // non-authorization status filter to what that function already
  // guaranteed belongs to the signed-in seller.
  const allListings = await getMyListings();
  const listings = filter ? allListings.filter((l) => l.status === filter) : allListings;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          My Cars{filter ? ` — ${filter.charAt(0) + filter.slice(1).toLowerCase()}` : ""}
        </h1>
        <Link
          href="/dashboard/listings/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + Add New Car
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {listings.map((listing) => (
          // SellerListingCard is a Client Component — Prisma's Decimal
          // (listing.price) isn't a plain serializable object, so it can't
          // cross the Server→Client boundary as-is. Converting to a number
          // here, once, is simpler than teaching every client component to
          // handle Decimal. Date formatting also happens here (once,
          // server-side) rather than in the client component, to avoid a
          // hydration mismatch from locale-dependent toLocaleDateString().
          <SellerListingCard
            key={listing.id}
            listing={{
              ...listing,
              price: Number(listing.price),
              listedDate: listing.createdAt.toLocaleDateString(),
            }}
          />
        ))}
        {listings.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            {filter
              ? `You don't have any ${filter.toLowerCase()} listings yet.`
              : "You haven't listed any cars yet."}
          </p>
        )}
      </div>
    </div>
  );
}
