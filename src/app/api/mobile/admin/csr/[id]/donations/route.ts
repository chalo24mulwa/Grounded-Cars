import { NextResponse, type NextRequest } from "next/server";
import { getCsrDonationsForAdmin } from "@/server/services/csr-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// View-only: { initiative, donations, totalRaised, donationCount }.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const result = await getCsrDonationsForAdmin(id);
      return NextResponse.json(result);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
