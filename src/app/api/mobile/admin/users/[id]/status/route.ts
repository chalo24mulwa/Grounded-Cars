import { NextResponse, type NextRequest } from "next/server";
import { setUserStatus } from "@/server/services/admin-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";
import type { UserStatus } from "@prisma/client";

// Body: { status: 'ACTIVE'|'SUSPENDED'|'DEACTIVATED', reason?: string }.
// ADMIN only — setUserStatus() itself blocks an admin from targeting their
// own account.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const result = await setUserStatus(id, body.status as UserStatus, body.reason);
      return NextResponse.json(result);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
