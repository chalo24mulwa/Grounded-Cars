import { NextResponse, type NextRequest } from "next/server";
import { getModeratorsForAdmin, createModeratorAccount } from "@/server/services/admin-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// ADMIN only. POST body matches createModeratorSchema:
// { name, email, password, phone? }.
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const moderators = await getModeratorsForAdmin();
      return NextResponse.json(moderators, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const body = await req.json();
      const moderator = await createModeratorAccount(body);
      return NextResponse.json(moderator, { status: 201 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
