import { notFound } from "next/navigation";
import { getPendingListingsForModeration } from "@/server/services/admin-service";
import { PendingListingRow } from "@/components/admin/PendingListingRow";
import { AuthorizationError } from "@/server/authorization/ownership";

export const metadata = { title: "Review Listings" };

// MODERATOR-only in practice (getPendingListingsForModeration also allows
// ADMIN, but admins already review from /admin). Approve/reject reuse the
// exact same actions and PendingListingRow component the admin dashboard
// uses — see approveListingAction/rejectListingAction in admin-actions.ts.
export default async function ReviewListingsPage() {
  let pendingListings;
  try {
    pendingListings = await getPendingListingsForModeration();
  } catch (error) {
    // A plain SELLER/BUYER passes the (seller) layout's own role gate (it
    // allows SELLER/ADMIN/MODERATOR) but isn't allowed here — same
    // "render as not found, not forbidden" posture as
    // requireListingOwnership elsewhere, rather than a raw error boundary.
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Review Listings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Approve or send back listings awaiting review, on behalf of the admin team.
      </p>

      <div className="mt-4 space-y-3">
        {pendingListings.map((listing) => (
          // PendingListingRow is a Client Component — Prisma's Decimal
          // (listing.price) can't cross the Server→Client boundary as-is.
          <PendingListingRow
            key={listing.id}
            listing={{ ...listing, price: Number(listing.price) }}
            showDetailsLink={false}
          />
        ))}
        {pendingListings.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Nothing awaiting review right now.
          </p>
        )}
      </div>
    </div>
  );
}
