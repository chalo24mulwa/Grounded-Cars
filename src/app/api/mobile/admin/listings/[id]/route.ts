import { NextResponse, type NextRequest } from "next/server";
import { deleteListingPermanently } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// ADMIN only, irreversible — deletes the listing and every photo stored
// for it. No reason taken, nothing kept.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const result = await deleteListingPermanently(id);
      return NextResponse.json(result);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
