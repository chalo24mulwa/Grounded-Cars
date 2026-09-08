import Link from "next/link";
import { CouponForm } from "@/components/admin/CouponForm";

export const metadata = { title: "New Coupon" };

export default function NewCouponPage() {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">New Coupon</h1>
        <Link href="/admin/coupons" className="text-sm font-medium text-brand hover:underline">
          ← Back to Coupons
        </Link>
      </div>

      <div className="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <CouponForm mode="create" />
      </div>
    </div>
  );
}
