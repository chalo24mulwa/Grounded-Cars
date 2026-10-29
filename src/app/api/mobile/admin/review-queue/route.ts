import { NextResponse, type NextRequest } from "next/server";
import { getPendingListingsForModeration } from "@/server/services/admin-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// ADMIN+MODERATOR — role check happens inside getPendingListingsForModeration().
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const listings = await getPendingListingsForModeration();
      return NextResponse.json(listings, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
