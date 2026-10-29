import { NextResponse, type NextRequest } from "next/server";
import { archiveListingByAdmin } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Body: { reason: string }. ADMIN only — distinct from a seller's own
// "Archive" (POST /api/mobile/my/listings/[id]/archive), which needs no
// reason.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const listing = await archiveListingByAdmin(id, body.reason);
      return NextResponse.json(listing);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
