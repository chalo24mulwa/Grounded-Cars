import { NextResponse } from "next/server";
import { getActiveFeaturedPlans } from "@/server/services/featured-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET() {
  try {
    const plans = await getActiveFeaturedPlans();
    return NextResponse.json(plans, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
