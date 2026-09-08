import Link from "next/link";
import { getAllCsrInitiativesForAdmin } from "@/server/services/csr-service";
import { Pagination } from "@/components/listings/Pagination";
import { CsrPublishToggle } from "@/components/admin/CsrPublishToggle";
import { CsrStatusSelect } from "@/components/admin/CsrStatusSelect";

export const metadata = { title: "CSR Initiatives" };

// Auth/role check lives in the (admin) layout — getAllCsrInitiativesForAdmin()
// still independently requires ADMIN, so data access is never gated by the
// layout alone.
export default async function AdminCsrPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { initiatives, totalCount, totalPages } = await getAllCsrInitiativesForAdmin({ page });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CSR Initiatives</h1>
          <p className="mt-1 text-sm text-slate-500">{totalCount.toLocaleString()} total.</p>
        </div>
        <Link
          href="/admin/csr/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + New Initiative
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {initiatives.map((initiative) => {
          const raised = Number(initiative.amountRaised);
          const target = Number(initiative.targetAmount);
          const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;

          return (
            <div
              key={initiative.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {initiative.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small admin-list thumbnail
                  <img src={initiative.coverImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    No photo
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{initiative.title}</p>
                <p className="text-xs text-slate-500">
                  {initiative.currency} {raised.toLocaleString()} raised of {target.toLocaleString()} ({pct}%)
                  {" · "}
                  {initiative._count.donations} successful donation{initiative._count.donations === 1 ? "" : "s"}
                </p>
              </div>

              <span
                className={
                  initiative.published
                    ? "rounded-md bg-status-active/10 px-2 py-0.5 text-xs font-medium text-status-active"
                    : "rounded-md bg-status-draft/10 px-2 py-0.5 text-xs font-medium text-status-draft"
                }
              >
                {initiative.published ? "Published" : "Draft"}
              </span>

              <CsrStatusSelect initiativeId={initiative.id} status={initiative.status} />

              <Link
                href={`/admin/csr/${initiative.id}/donations`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
              >
                Donations
              </Link>
              <Link
                href={`/admin/csr/${initiative.id}/edit`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
              >
                Edit
              </Link>
              <CsrPublishToggle initiativeId={initiative.id} published={initiative.published} />
            </div>
          );
        })}
        {initiatives.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No CSR initiatives yet — create one above.
          </p>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => (p > 1 ? `/admin/csr?page=${p}` : "/admin/csr")}
      />
    </div>
  );
}
