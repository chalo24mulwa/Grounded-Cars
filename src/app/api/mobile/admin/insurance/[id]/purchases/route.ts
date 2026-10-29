import { NextResponse, type NextRequest } from "next/server";
import { getInsurancePurchasesForAdmin } from "@/server/services/insurance-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// View-only: { policy, purchases, totalRevenue, purchaseCount }.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const result = await getInsurancePurchasesForAdmin(id);
      return NextResponse.json(result);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
