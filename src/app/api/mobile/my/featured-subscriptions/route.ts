import { NextResponse, type NextRequest } from "next/server";
import { getMyFeaturedSubscriptions } from "@/server/services/featured-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const subscriptions = await getMyFeaturedSubscriptions();
      return NextResponse.json(subscriptions, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
