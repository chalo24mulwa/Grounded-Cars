import { NextResponse, type NextRequest } from "next/server";
import { markListingAsSold } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const listing = await markListingAsSold(id);
      return NextResponse.json(listing);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
