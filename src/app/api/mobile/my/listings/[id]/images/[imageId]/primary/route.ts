import { NextResponse, type NextRequest } from "next/server";
import { setPrimaryListingImage } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id, imageId } = await params;
      await setPrimaryListingImage(id, imageId);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
