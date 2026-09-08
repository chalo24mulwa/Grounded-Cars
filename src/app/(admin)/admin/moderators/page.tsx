import Link from "next/link";
import { getModeratorsForAdmin } from "@/server/services/admin-service";
import { UserStatusControl } from "@/components/admin/UserStatusControl";
import { DeleteModeratorButton } from "@/components/admin/DeleteModeratorButton";

export const metadata = { title: "Moderators" };

// Dedicated to role MODERATOR only — the generic user list at /admin/users
// still shows everyone (including moderators) and is untouched by this
// page. Creating an account only happens here (see /admin/moderators/new);
// there is no public/self-service registration path to this role anywhere
// else in the app.
export default async function AdminModeratorsPage() {
  const moderators = await getModeratorsForAdmin();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Moderators</h1>
          <p className="mt-1 text-sm text-slate-500">
            Full seller access, plus reviewing pending listings and viewing the seller directory —
            never the rest of this admin area, and never able to deactivate a seller themselves.
          </p>
        </div>
        <Link
          href="/admin/moderators/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + New Moderator
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Listings</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {moderators.map((moderator) => (
              <tr key={moderator.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{moderator.name}</p>
                  <p className="text-xs text-slate-500">{moderator.email}</p>
                  {moderator.phone && <p className="text-xs text-slate-400">{moderator.phone}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">{moderator.status}</td>
                <td className="px-4 py-3 text-slate-600">{moderator._count.listings}</td>
                <td className="px-4 py-3 text-slate-400">{moderator.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-end gap-2">
                    <UserStatusControl userId={moderator.id} status={moderator.status} />
                    <DeleteModeratorButton userId={moderator.id} name={moderator.name} />
                  </div>
                </td>
              </tr>
            ))}
            {moderators.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  No moderators yet — create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
