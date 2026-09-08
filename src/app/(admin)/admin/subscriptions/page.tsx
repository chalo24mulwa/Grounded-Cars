import Link from "next/link";
import { getAllSubscriptionsForAdmin } from "@/server/services/featured-service";
import { Pagination } from "@/components/listings/Pagination";
import type { FeaturedSubscriptionStatus } from "@prisma/client";

export const metadata = { title: "Featured Subscriptions" };

const STATUSES: FeaturedSubscriptionStatus[] = ["PENDING", "ACTIVE", "EXPIRED", "CANCELLED", "PAYMENT_FAILED"];

const STATUS_STYLES: Record<FeaturedSubscriptionStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  EXPIRED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-slate-100 text-slate-500",
  PAYMENT_FAILED: "bg-red-50 text-red-700",
};

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status: rawStatus, page: pageParam } = await searchParams;
  const status = STATUSES.includes(rawStatus as FeaturedSubscriptionStatus)
    ? (rawStatus as FeaturedSubscriptionStatus)
    : undefined;
  const page = Math.max(1, Number(pageParam) || 1);

  const { subscriptions, totalCount, totalPages } = await getAllSubscriptionsForAdmin({ status, page });

  function hrefFor(overrides: { status?: string; page?: number }) {
    const params = new URLSearchParams();
    const s = overrides.status !== undefined ? overrides.status : status;
    const p = overrides.page ?? 1;
    if (s) params.set("status", s);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/subscriptions?${qs}` : "/admin/subscriptions";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Featured Subscriptions</h1>
      <p className="mt-1 text-sm text-slate-500">
        {totalCount.toLocaleString()} total. Read-only — payment records cannot be edited here.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={hrefFor({ status: "" })}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            !status ? "bg-brand text-white" : "border border-slate-300 text-slate-600 hover:bg-brand-subtle"
          }`}
        >
          All
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

      <div className="mt-4 space-y-3">
        {subscriptions.map((sub) => (
          <div key={sub.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{sub.listing.title}</p>
                <p className="text-sm text-slate-500">
                  {sub.plan.name} · {sub.plan.durationDays} days · {sub.plan.currency}{" "}
                  {Number(sub.plan.price).toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Bought by {sub.user.name} ({sub.user.email})
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[sub.status]}`}>
                {sub.status}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Starts: {sub.startedAt ? sub.startedAt.toLocaleDateString() : "—"}</span>
              <span>Expires: {sub.expiresAt ? sub.expiresAt.toLocaleDateString() : "—"}</span>
              <span>Listing status: {sub.listing.status}</span>
            </div>

            {sub.payments.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase text-slate-400">Payment attempts</p>
                <div className="space-y-1">
                  {sub.payments.map((payment) => (
                    <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">
                        {payment.initiatedAt.toLocaleString()} · {payment.currency}{" "}
                        {Number(payment.amount).toLocaleString()}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 font-medium ${
                          payment.status === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700"
                            : payment.status === "FAILED"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {subscriptions.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No subscriptions match this filter.
          </p>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} buildHref={(p) => hrefFor({ page: p })} />
    </div>
  );
}
