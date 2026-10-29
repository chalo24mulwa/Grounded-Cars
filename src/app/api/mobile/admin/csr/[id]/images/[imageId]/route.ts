import { NextResponse, type NextRequest } from "next/server";
import { removeCsrInitiativeImage } from "@/server/services/csr-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id, imageId } = await params;
      await removeCsrInitiativeImage(id, imageId);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
