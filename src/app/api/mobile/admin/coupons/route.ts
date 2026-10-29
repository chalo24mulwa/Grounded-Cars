import { NextResponse, type NextRequest } from "next/server";
import { getAllCouponsForAdmin, createCoupon } from "@/server/services/coupon-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// ADMIN-only — enforced inside getAllCouponsForAdmin()/createCoupon()
// themselves (requireRole("ADMIN")), so this route never re-checks roles.
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const coupons = await getAllCouponsForAdmin();
      return NextResponse.json(coupons);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

// Body: { code: string, discountPercent: string, usageLimitPerUser: string }
// — discountPercent/usageLimitPerUser MUST be strings (createCouponSchema's
// wholeNumberString transform expects a string input, same convention as
// every other money/count field validated from FormData elsewhere in this
// app); sending a number fails Zod validation.
export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const body = await req.json();
      const coupon = await createCoupon(body);
      return NextResponse.json(coupon, { status: 201 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
