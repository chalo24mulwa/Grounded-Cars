import { NextResponse, type NextRequest } from "next/server";
import { getUsersForAdmin } from "@/server/services/admin-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";
import type { UserRole, UserStatus } from "@prisma/client";

// ADMIN only — role check happens inside getUsersForAdmin(). Never selects
// passwordHash (that's enforced server-side, same as the website).
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const params = req.nextUrl.searchParams;
      const role = params.get("role") as UserRole | null;
      const status = params.get("status") as UserStatus | null;
      const q = params.get("q");
      const pageParam = params.get("page");
      const result = await getUsersForAdmin({
        role: role ?? undefined,
        status: status ?? undefined,
        q: q ?? undefined,
        page: pageParam ? Number(pageParam) : undefined,
      });
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
