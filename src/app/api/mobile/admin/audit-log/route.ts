import { NextResponse, type NextRequest } from "next/server";
import { getAuditLog } from "@/server/services/audit-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// ADMIN only — role check happens inside getAuditLog().
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const params = req.nextUrl.searchParams;
      const pageParam = params.get("page");
      const pageSizeParam = params.get("pageSize");
      const result = await getAuditLog({
        page: pageParam ? Number(pageParam) : undefined,
        pageSize: pageSizeParam ? Number(pageSizeParam) : undefined,
      });
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
