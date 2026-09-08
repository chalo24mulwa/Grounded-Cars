import Link from "next/link";
import { auth } from "@/lib/auth";
import { getAdminOverview, getPendingListingsForModeration } from "@/server/services/admin-service";
import { StatCard } from "@/components/ui/StatCard";
import { PendingListingRow } from "@/components/admin/PendingListingRow";

export const metadata = { title: "Admin" };

// Auth/role check lives in the (admin) layout now — this page trusts it for
// the redirect, but getAdminOverview()/getPendingListingsForModeration()
// below still independently require ADMIN, so the data access is never
// gated by the layout alone.
export default async function AdminPage() {
  const session = await auth();

  const [overview, pendingListings] = await Promise.all([
    getAdminOverview(),
    getPendingListingsForModeration(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
          <p className="mt-1 text-slate-500">Signed in as {session?.user.name}.</p>
        </div>
        <Link
          href="/admin/plans"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-subtle"
        >
          Manage Featured Plans
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Users" value={overview.totalUsers} />
        <StatCard label="Sellers" value={overview.totalSellers} />
        <StatCard label="Buyers" value={overview.totalBuyers} />
        <StatCard label="Total Listings" value={overview.totalListings} />
        <StatCard label="Active" value={overview.activeListings} />
        <StatCard label="Pending Review" value={overview.pendingListings} />
        <StatCard label="Sold" value={overview.soldListings} />
        <StatCard label="Featured Active" value={overview.featuredActiveListings} />
        <StatCard label="Active CSR Initiatives" value={overview.activeCsrInitiatives} />
        <StatCard label="CSR Raised (KES)" value={overview.csrTotalRaised.toLocaleString()} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent registrations</h2>
          <ul className="space-y-2">
            {overview.recentRegistrations.map((user) => (
              <li key={user.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {user.name} <span className="text-slate-400">({user.role})</span>
                </span>
                <span className="text-xs text-slate-400">{user.createdAt.toLocaleDateString()}</span>
              </li>
            ))}
            {overview.recentRegistrations.length === 0 && (
              <li className="text-sm text-slate-400">No users yet.</li>
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent listings</h2>
          <ul className="space-y-2">
            {overview.recentListings.map((listing) => (
              <li key={listing.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-slate-700">{listing.title}</span>
                <span className="ml-2 shrink-0 text-xs text-slate-400">{listing.status}</span>
              </li>
            ))}
            {overview.recentListings.length === 0 && (
              <li className="text-sm text-slate-400">No listings yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">
          Listings awaiting approval
          {pendingListings.length > 0 && (
            <span className="ml-2 rounded-full bg-status-pending/10 px-2 py-0.5 text-xs font-semibold text-status-pending">
              {pendingListings.length}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          New listings require admin approval before they go live on the public marketplace.
        </p>

        <div className="mt-4 space-y-3">
          {pendingListings.map((listing) => (
            // PendingListingRow is a Client Component — Prisma's Decimal
            // (listing.price) can't cross the Server→Client boundary as-is.
            <PendingListingRow key={listing.id} listing={{ ...listing, price: Number(listing.price) }} />
          ))}
          {pendingListings.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Nothing awaiting review right now.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
