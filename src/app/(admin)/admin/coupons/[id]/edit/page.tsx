import Link from "next/link";
import { notFound } from "next/navigation";
import { getCouponForAdmin, CouponNotFoundForAdminError } from "@/server/services/coupon-service";
import { CouponForm } from "@/components/admin/CouponForm";

export const metadata = { title: "Edit Coupon" };

export default async function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let coupon;
  try {
    coupon = await getCouponForAdmin(id);
  } catch (error) {
    if (error instanceof CouponNotFoundForAdminError) notFound();
    throw error;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Edit Coupon</h1>
        <Link href="/admin/coupons" className="text-sm font-medium text-brand hover:underline">
          ← Back to Coupons
        </Link>
      </div>

      <div className="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <CouponForm
          mode="edit"
          couponId={coupon.id}
          defaults={{
            code: coupon.code,
            discountPercent: String(coupon.discountPercent),
            usageLimitPerUser: String(coupon.usageLimitPerUser),
          }}
        />
      </div>
    </div>
  );
}
