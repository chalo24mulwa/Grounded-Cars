import Link from "next/link";
import { notFound } from "next/navigation";
import { getCouponRedemptionsForAdmin, CouponNotFoundForAdminError } from "@/server/services/coupon-service";

export const metadata = { title: "Coupon Redemptions" };

const scopeLabel: Record<string, string> = {
  FEATURED_LISTING: "Featured Listing",
  SERVICE_ORDER: "Service order",
};

export default async function CouponRedemptionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data;
  try {
    data = await getCouponRedemptionsForAdmin(id);
  } catch (error) {
    if (error instanceof CouponNotFoundForAdminError) notFound();
    throw error;
  }

  const { coupon, redemptions, totalDiscountGiven, redemptionCount } = data;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Redemptions</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{coupon.code}</p>
        </div>
        <Link href="/admin/coupons" className="text-sm font-medium text-brand hover:underline">
          ← Back to Coupons
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Discount</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{coupon.discountPercent}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total redemptions</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{redemptionCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total discount given</p>
          <p className="mt-1 text-xl font-bold text-slate-900">KES {totalDiscountGiven.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Date</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Used for</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">By</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Original</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {redemptions.map((redemption) => (
              <tr key={redemption.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                  {redemption.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {scopeLabel[redemption.scope] ?? redemption.scope}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {redemption.user?.name ?? redemption.user?.email ?? redemption.customerPhone ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-500 line-through">
                  KES {Number(redemption.originalAmount).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-900">
                  KES {Number(redemption.discountedAmount).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {redemptions.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">No redemptions yet for this coupon.</p>
        )}
      </div>
    </div>
  );
}
