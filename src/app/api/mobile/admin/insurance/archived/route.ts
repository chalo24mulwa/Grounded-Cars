import { NextResponse, type NextRequest } from "next/server";
import { getArchivedInsurancePoliciesForAdmin } from "@/server/services/insurance-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const policies = await getArchivedInsurancePoliciesForAdmin();
      return NextResponse.json(policies);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
