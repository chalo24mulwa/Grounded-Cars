import Link from "next/link";
import {
  getAllInsurancePoliciesForAdmin,
  getArchivedInsurancePoliciesForAdmin,
} from "@/server/services/insurance-service";
import { Pagination } from "@/components/listings/Pagination";
import { InsurancePolicyPublishToggle } from "@/components/admin/InsurancePolicyPublishToggle";
import { InsurancePolicyArchiveButton } from "@/components/admin/InsurancePolicyArchiveButton";

export const metadata = { title: "Insurance Policies" };

// Auth/role check lives in the (admin) layout — the service functions
// still independently require ADMIN, so data access is never gated by the
// layout alone.
export default async function AdminInsurancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ policies, totalCount, totalPages }, archivedPolicies] = await Promise.all([
    getAllInsurancePoliciesForAdmin({ page }),
    getArchivedInsurancePoliciesForAdmin(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Insurance Policies</h1>
          <p className="mt-1 text-sm text-slate-500">{totalCount.toLocaleString()} total.</p>
        </div>
        <Link
          href="/admin/insurance/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + New Policy
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {policies.map((policy) => (
          <div
            key={policy.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {policy.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small admin-list thumbnail
                <img src={policy.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No photo
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{policy.title}</p>
              <p className="text-xs text-slate-500">
                {policy.currency} {Number(policy.startingPrice).toLocaleString()} starting
              </p>
            </div>

            <span
              className={
                policy.published
                  ? "rounded-md bg-status-active/10 px-2 py-0.5 text-xs font-medium text-status-active"
                  : "rounded-md bg-status-draft/10 px-2 py-0.5 text-xs font-medium text-status-draft"
              }
            >
              {policy.published ? "Published" : "Draft"}
            </span>

            <Link
              href={`/admin/insurance/${policy.id}/purchases`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
            >
              Purchases
            </Link>
            <Link
              href={`/admin/insurance/${policy.id}/edit`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
            >
              Edit
            </Link>
            <InsurancePolicyPublishToggle policyId={policy.id} published={policy.published} />
            <InsurancePolicyArchiveButton policyId={policy.id} mode="archive" />
          </div>
        ))}
        {policies.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No insurance policies yet — create one above.
          </p>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => (p > 1 ? `/admin/insurance?page=${p}` : "/admin/insurance")}
      />

      {archivedPolicies.length > 0 && (
        <details className="mt-8 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-900">
            Archived ({archivedPolicies.length})
          </summary>
          <div className="space-y-3 border-t border-slate-200 p-4">
            {archivedPolicies.map((policy) => (
              <div
                key={policy.id}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-700">{policy.title}</p>
                  <p className="text-xs text-slate-500">
                    {policy.currency} {Number(policy.startingPrice).toLocaleString()} starting
                  </p>
                </div>
                <InsurancePolicyArchiveButton policyId={policy.id} mode="unarchive" />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
