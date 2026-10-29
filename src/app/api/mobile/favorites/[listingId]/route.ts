import { NextResponse, type NextRequest } from "next/server";
import { addFavorite, removeFavorite } from "@/server/services/favorite-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Both idempotent (see favorite-service.ts) — mobile doesn't replicate the
// website's cm_fav cookie (that's a web-only page-render optimization); the
// client just flips its own local heart state after a 204.
export async function POST(req: NextRequest, { params }: { params: Promise<{ listingId: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { listingId } = await params;
      await addFavorite(listingId);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ listingId: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { listingId } = await params;
      await removeFavorite(listingId);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
