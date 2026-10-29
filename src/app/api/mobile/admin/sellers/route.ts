import { NextResponse, type NextRequest } from "next/server";
import { getSellersForModerator } from "@/server/services/admin-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// ADMIN+MODERATOR, read-only directory — no status field or action.
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const sellers = await getSellersForModerator();
      return NextResponse.json(sellers, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
