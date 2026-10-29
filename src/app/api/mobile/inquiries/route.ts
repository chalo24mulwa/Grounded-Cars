import { NextResponse, type NextRequest } from "next/server";
import {
  createInquiry,
  ListingNotAvailableError,
  ListingNotFoundError,
  DuplicateInquiryError,
} from "@/server/services/inquiry-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Body: { listingId, message }. Every identity field (buyer, seller) is
// server-derived from the session and the listing itself — see
// createInquiry()'s own comment.
export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const body = await req.json();
      const inquiry = await createInquiry(body);
      return NextResponse.json(inquiry, { status: 201 });
    } catch (error) {
      if (
        error instanceof ListingNotAvailableError ||
        error instanceof ListingNotFoundError ||
        error instanceof DuplicateInquiryError
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return mobileErrorResponse(error);
    }
  });
}
