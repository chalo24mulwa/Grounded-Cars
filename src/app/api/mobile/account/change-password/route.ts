import { NextResponse, type NextRequest } from "next/server";
import { changePassword, InvalidCurrentPasswordError } from "@/server/services/auth-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const body = await req.json();
      await changePassword(body);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      if (error instanceof InvalidCurrentPasswordError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return mobileErrorResponse(error);
    }
  });
}
