import { NextResponse, type NextRequest } from "next/server";
import { getCouponRedemptionsForAdmin } from "@/server/services/coupon-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Returns { coupon, redemptions, totalDiscountGiven, redemptionCount }.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const result = await getCouponRedemptionsForAdmin(id);
      return NextResponse.json(result);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
