import { NextResponse, type NextRequest } from "next/server";
import { getServiceOrdersForAdmin } from "@/server/services/service-catalog-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// View-only: { service, orders, totalRevenue, orderCount }.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const result = await getServiceOrdersForAdmin(id);
      return NextResponse.json(result);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
