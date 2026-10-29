import { NextResponse, type NextRequest } from "next/server";
import { archiveInsurancePolicy } from "@/server/services/insurance-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const policy = await archiveInsurancePolicy(id);
      return NextResponse.json(policy);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
