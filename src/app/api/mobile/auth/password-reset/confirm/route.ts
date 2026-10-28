import { NextResponse, type NextRequest } from "next/server";
import { resetPassword, InvalidOrExpiredTokenError } from "@/server/services/password-reset-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await resetPassword(body);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof InvalidOrExpiredTokenError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return mobileErrorResponse(error);
  }
}
