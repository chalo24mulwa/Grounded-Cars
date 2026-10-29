import { NextResponse, type NextRequest } from "next/server";
import { updateInquiryStatus } from "@/server/services/inquiry-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Body: { status: "NEW" | "READ" | "REPLIED" | "CLOSED" }.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const inquiry = await updateInquiryStatus(id, body.status);
      return NextResponse.json(inquiry);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
