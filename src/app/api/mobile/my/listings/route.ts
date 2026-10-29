import { NextResponse, type NextRequest } from "next/server";
import { getMyListings, createListing } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Same getMyListings()/createListing() the website's seller dashboard uses.
// createListing() always starts a listing as DRAFT — submitting it for
// review (PENDING, awaiting admin approval before it's ever publicly
// visible) is the separate my/listings/[id]/submit route.
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const listings = await getMyListings();
      return NextResponse.json(listings);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const body = await req.json();
      const listing = await createListing(body);
      return NextResponse.json(listing, { status: 201 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
