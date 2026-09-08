import { notFound } from "next/navigation";
import { getSellersForModerator } from "@/server/services/admin-service";
import { AuthorizationError } from "@/server/authorization/ownership";

export const metadata = { title: "Sellers" };

// MODERATOR-only in practice (getSellersForModerator also allows ADMIN, but
// admins already have the fuller /admin/users). Read-only: no status
// column, no action to change one — (de)activating an account stays an
// ADMIN-only power (see /admin/users), never reachable from here.
export default async function ModeratorSellersPage() {
  let sellers;
  try {
    sellers = await getSellersForModerator();
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
      <h1 className="text-2xl font-bold text-slate-900">Sellers</h1>
      <p className="mt-1 text-sm text-slate-500">{sellers.length.toLocaleString()} total.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Listings</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((seller) => (
              <tr key={seller.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{seller.name}</td>
                <td className="px-4 py-3 text-slate-600">{seller.email}</td>
                <td className="px-4 py-3 text-slate-600">{seller.phone ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{seller._count.listings}</td>
                <td className="px-4 py-3 text-slate-400">{seller.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {sellers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  No sellers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
