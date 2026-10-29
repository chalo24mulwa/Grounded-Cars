import { NextResponse, type NextRequest } from "next/server";
import { getSellerDashboardStats } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const stats = await getSellerDashboardStats();
      return NextResponse.json(stats);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
