import { NextResponse, type NextRequest } from "next/server";
import { getAllListingsForAdmin } from "@/server/services/admin-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";
import type { ListingStatus } from "@prisma/client";

// ADMIN only — role check happens inside getAllListingsForAdmin().
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const status = req.nextUrl.searchParams.get("status") as ListingStatus | null;
      const pageParam = req.nextUrl.searchParams.get("page");
      const page = pageParam ? Number(pageParam) : undefined;
      const result = await getAllListingsForAdmin({ status: status ?? undefined, page });
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
