import { NextResponse, type NextRequest } from "next/server";
import { getMyFavorites } from "@/server/services/favorite-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const favorites = await getMyFavorites();
      return NextResponse.json(favorites);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
