import { NextResponse, type NextRequest } from "next/server";
import { submitListingForReview } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// DRAFT -> PENDING. Same assertValidTransition() rules as the website: this
// can NEVER itself reach ACTIVE — only an admin/moderator's approval
// (website-only moderation flow) can do that, so a mobile-submitted
// listing stays invisible to the public marketplace until approved, exactly
// like one submitted from the website.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const listing = await submitListingForReview(id);
      return NextResponse.json(listing);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
