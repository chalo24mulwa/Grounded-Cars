import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUsersForAdmin } from "@/server/services/admin-service";
import { Pagination } from "@/components/listings/Pagination";
import { UserStatusControl } from "@/components/admin/UserStatusControl";
import { ImpersonateUserButton } from "@/components/admin/ImpersonateUserButton";
import type { UserRole, UserStatus } from "@prisma/client";

export const metadata = { title: "Users" };

const ROLES: UserRole[] = ["BUYER", "SELLER", "MODERATOR", "ADMIN"];
const STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; status?: string; q?: string; page?: string }>;
}) {
  const { role: rawRole, status: rawStatus, q: rawQ, page: pageParam } = await searchParams;
  const role = ROLES.includes(rawRole as UserRole) ? (rawRole as UserRole) : undefined;
  const status = STATUSES.includes(rawStatus as UserStatus) ? (rawStatus as UserStatus) : undefined;
  const q = rawQ?.trim() || undefined;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ users, totalCount, totalPages }, session] = await Promise.all([
    getUsersForAdmin({ role, status, q, page }),
    auth(),
  ]);
  const currentAdminId = session?.user?.id;

  function hrefFor(overrides: { role?: string; status?: string; q?: string; page?: number }) {
    const params = new URLSearchParams();
    const r = overrides.role !== undefined ? overrides.role : role;
    const s = overrides.status !== undefined ? overrides.status : status;
    const query = overrides.q !== undefined ? overrides.q : q;
    const p = overrides.page ?? 1;
    if (r) params.set("role", r);
    if (s) params.set("status", s);
    if (query) params.set("q", query);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Users</h1>
      <p className="mt-1 text-sm text-slate-500">{totalCount.toLocaleString()} total.</p>

      <form className="mt-4 flex flex-wrap items-center gap-2" action="/admin/users" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name or email…"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {role && <input type="hidden" name="role" value={role} />}
        {status && <input type="hidden" name="status" value={status} />}
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-brand-subtle"
        >
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={hrefFor({ role: "" })}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            !role ? "bg-brand text-white" : "border border-slate-300 text-slate-600 hover:bg-brand-subtle"
          }`}
        >
          All roles
        </Link>
        {ROLES.map((r) => (
          <Link
            key={r}
            href={hrefFor({ role: r })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              role === r ? "bg-brand text-white" : "border border-slate-300 text-slate-600 hover:bg-brand-subtle"
            }`}
          >
            {r}
          </Link>
        ))}
        <span className="mx-1 self-center text-slate-300">|</span>
        <Link
          href={hrefFor({ status: "" })}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            !status ? "bg-brand text-white" : "border border-slate-300 text-slate-600 hover:bg-brand-subtle"
          }`}
        >
          All statuses
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={hrefFor({ status: s })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              status === s ? "bg-brand text-white" : "border border-slate-300 text-slate-600 hover:bg-brand-subtle"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Listings</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{user.role}</td>
                <td className="px-4 py-3 text-slate-600">{user.status}</td>
                <td className="px-4 py-3 text-slate-600">{user._count.listings}</td>
                <td className="px-4 py-3 text-slate-400">{user.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-end gap-2">
                    <UserStatusControl userId={user.id} status={user.status} />
                    {user.role !== "ADMIN" && user.id !== currentAdminId && (
                      <ImpersonateUserButton userId={user.id} userName={user.name} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No users match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} buildHref={(p) => hrefFor({ page: p })} />
    </div>
  );
}
