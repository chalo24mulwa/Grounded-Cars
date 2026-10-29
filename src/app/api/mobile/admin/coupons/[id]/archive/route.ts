import { NextResponse, type NextRequest } from "next/server";
import { archiveCoupon } from "@/server/services/coupon-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const coupon = await archiveCoupon(id);
      return NextResponse.json(coupon);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
