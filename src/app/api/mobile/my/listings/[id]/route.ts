import { NextResponse, type NextRequest } from "next/server";
import { getListingForEdit, updateListing, getLatestRejectionReason } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Same getListingForEdit() (ownership-checked) the website's seller edit
// page uses, with the latest PENDING->DRAFT rejection note (if any) folded
// in — the "My Listings"/"Edit Car" screens' one data source.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const [listing, rejectionReason] = await Promise.all([
        getListingForEdit(id),
        getLatestRejectionReason(id),
      ]);
      return NextResponse.json({ ...listing, rejectionReason });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

// Never accepts `status` — see updateListing()'s own comment; status moves
// exclusively through the submit/archive/restore-draft/mark-sold/
// restore-active routes below, each going through the centrally-validated
// transition table.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const listing = await updateListing(id, body);
      return NextResponse.json(listing);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
