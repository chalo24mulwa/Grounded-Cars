import { NextResponse, type NextRequest } from "next/server";
import { getArchivedCouponsForAdmin } from "@/server/services/coupon-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const coupons = await getArchivedCouponsForAdmin();
      return NextResponse.json(coupons);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
