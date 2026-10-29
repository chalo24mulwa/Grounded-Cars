import { NextResponse, type NextRequest } from "next/server";
import { getMyReceivedInquiries } from "@/server/services/inquiry-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Seller inbox — same role gate as the website (SELLER/ADMIN/MODERATOR),
// enforced inside getMyReceivedInquiries() itself.
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const inquiries = await getMyReceivedInquiries();
      return NextResponse.json(inquiries);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
