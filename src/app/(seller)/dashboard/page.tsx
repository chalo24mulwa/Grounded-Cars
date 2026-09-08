import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSellerDashboardStats } from "@/server/services/listing-service";
import { StatCard } from "@/components/ui/StatCard";

// Title reflects who's actually signed in — a MODERATOR isn't a seller,
// even though this page (and its stats) are otherwise identical for both
// roles. See generateMetadata below for the matching browser-tab title.
export async function generateMetadata() {
  const session = await auth();
  return { title: session?.user.role === "MODERATOR" ? "Moderator dashboard" : "Seller dashboard" };
}

// Auth/role check lives in the (seller) layout now — this page trusts it
// for the redirect, but getSellerDashboardStats() below still independently
// requires SELLER/ADMIN/MODERATOR, so the data access itself is never
// gated by the layout alone.
export default async function DashboardPage() {
  const session = await auth();
  const counts = await getSellerDashboardStats();
  const heading = session?.user.role === "MODERATOR" ? "Moderator dashboard" : "Seller dashboard";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
          <p className="mt-1 text-slate-500">Welcome back, {session?.user.name}.</p>
        </div>
        <Link
          href="/dashboard/listings/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + Add New Car
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Listings" value={counts.total} />
        <StatCard label="Active" value={counts.active} />
        <StatCard label="Pending Review" value={counts.pending} />
        <StatCard label="Sold" value={counts.sold} />
        <StatCard label="Drafts" value={counts.draft} />
        <StatCard label="Total Views" value={counts.views} />
      </div>

      {counts.pending > 0 && (
        <p className="mt-4 rounded-md bg-status-pending/10 px-3 py-2 text-sm text-status-pending">
          {counts.pending} listing{counts.pending > 1 ? "s are" : " is"} awaiting admin approval
          before going live.
        </p>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Quick links</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/dashboard/listings" className="text-sm font-medium text-brand hover:underline">
            View all my cars
          </Link>
          <Link
            href="/dashboard/listings?status=SOLD"
            className="text-sm font-medium text-brand hover:underline"
          >
            View sold cars
          </Link>
        </div>
      </div>
    </div>
  );
}
