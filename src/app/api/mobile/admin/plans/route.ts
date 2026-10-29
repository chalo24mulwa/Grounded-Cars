import { NextResponse, type NextRequest } from "next/server";
import { getAllFeaturedPlansForAdmin, createFeaturedPlan } from "@/server/services/featured-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const plans = await getAllFeaturedPlansForAdmin();
      return NextResponse.json(plans);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

// Body: { name: string, durationDays: number, price: number, currency: string }
// — plain numbers (unlike coupons), createFeaturedPlan() has no Zod schema
// of its own and takes these fields as-is.
export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const body = await req.json();
      const plan = await createFeaturedPlan(body);
      return NextResponse.json(plan, { status: 201 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
