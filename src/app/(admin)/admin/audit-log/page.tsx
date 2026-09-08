import { getAuditLog } from "@/server/services/audit-service";
import { Pagination } from "@/components/listings/Pagination";

export const metadata = { title: "Audit Log" };

const ACTION_LABELS: Record<string, string> = {
  LISTING_APPROVED: "Listing approved",
  LISTING_REJECTED: "Listing rejected",
  LISTING_ARCHIVED_BY_ADMIN: "Listing archived by admin",
  USER_STATUS_CHANGED: "User status changed",
  FEATURED_PLAN_CREATED: "Featured plan created",
  FEATURED_PLAN_STATUS_CHANGED: "Featured plan status changed",
  ROLE_UPGRADED_TO_SELLER: "User became a seller",
};

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { entries, totalCount, totalPages } = await getAuditLog({ page });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
      <p className="mt-1 text-sm text-slate-500">
        {totalCount.toLocaleString()} entries. Append-only record of sensitive admin actions.
      </p>

      <div className="mt-4 space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </p>
                <p className="text-xs text-slate-500">
                  {entry.actor ? `${entry.actor.name} (${entry.actor.email})` : "Unknown actor (account deleted)"} ·{" "}
                  {entry.entityType} {entry.entityId}
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{entry.createdAt.toLocaleString()}</span>
            </div>
            {entry.metadata !== null && entry.metadata !== undefined && (
              <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {entries.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No audit entries yet.
          </p>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(p) => (p > 1 ? `/admin/audit-log?page=${p}` : "/admin/audit-log")}
      />
    </div>
  );
}
