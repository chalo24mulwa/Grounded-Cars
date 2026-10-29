import { NextResponse, type NextRequest } from "next/server";
import { archiveListing } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const listing = await archiveListing(id);
      return NextResponse.json(listing);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
