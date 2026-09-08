import Link from "next/link";
import { getAllCouponsForAdmin, getArchivedCouponsForAdmin } from "@/server/services/coupon-service";
import { CouponArchiveButton } from "@/components/admin/CouponArchiveButton";

export const metadata = { title: "Coupons" };

// Auth/role check lives in the (admin) layout — the service functions
// still independently require ADMIN, so data access is never gated by the
// layout alone.
export default async function AdminCouponsPage() {
  const [coupons, archivedCoupons] = await Promise.all([
    getAllCouponsForAdmin(),
    getArchivedCouponsForAdmin(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coupons</h1>
          <p className="mt-1 text-sm text-slate-500">
            Discount codes for Featured Listings and orderable Services — never CSR donations or
            Insurance purchases.
          </p>
        </div>
        <Link
          href="/admin/coupons/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          + New Coupon
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {coupons.map((coupon) => (
          <div
            key={coupon.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono font-semibold text-slate-900">{coupon.code}</p>
              <p className="text-xs text-slate-500">
                {coupon.discountPercent}% off · up to {coupon.usageLimitPerUser} use
                {coupon.usageLimitPerUser === 1 ? "" : "s"} per user · {coupon._count.redemptions} redemption
                {coupon._count.redemptions === 1 ? "" : "s"}
              </p>
            </div>

            <Link
              href={`/admin/coupons/${coupon.id}/redemptions`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
            >
              Redemptions
            </Link>
            <Link
              href={`/admin/coupons/${coupon.id}/edit`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle"
            >
              Edit
            </Link>
            <CouponArchiveButton couponId={coupon.id} mode="archive" />
          </div>
        ))}
        {coupons.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No coupons yet — create one above.
          </p>
        )}
      </div>

      {archivedCoupons.length > 0 && (
        <details className="mt-8 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-900">
            Archived ({archivedCoupons.length})
          </summary>
          <div className="space-y-3 border-t border-slate-200 p-4">
            {archivedCoupons.map((coupon) => (
              <div
                key={coupon.id}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-medium text-slate-700">{coupon.code}</p>
                  <p className="text-xs text-slate-500">
                    {coupon.discountPercent}% off · {coupon._count.redemptions} redemption
                    {coupon._count.redemptions === 1 ? "" : "s"}
                  </p>
                </div>
                <CouponArchiveButton couponId={coupon.id} mode="unarchive" />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
