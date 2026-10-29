import { NextResponse, type NextRequest } from "next/server";
import { getCouponForAdmin, updateCoupon } from "@/server/services/coupon-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const coupon = await getCouponForAdmin(id);
      return NextResponse.json(coupon);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

// Body: { code: string, discountPercent: string, usageLimitPerUser: string }
// — same string-field requirement as POST /api/mobile/admin/coupons.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const coupon = await updateCoupon(id, body);
      return NextResponse.json(coupon);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
