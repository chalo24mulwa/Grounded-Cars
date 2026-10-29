import { NextResponse, type NextRequest } from "next/server";
import { reorderListingImages } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Body: { imageIds: string[] } — exactly the listing's current image ids,
// in the desired order (same contract as reorderListingImages() itself).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      await reorderListingImages(id, body.imageIds);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
