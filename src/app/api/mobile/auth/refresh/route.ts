import { NextResponse, type NextRequest } from "next/server";
import { refreshMobileSession, InvalidRefreshTokenError } from "@/server/mobile/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (typeof refreshToken !== "string" || !refreshToken) {
      return NextResponse.json({ error: "refreshToken is required." }, { status: 400 });
    }

    const tokens = await refreshMobileSession(refreshToken);
    return NextResponse.json(tokens);
  } catch (error) {
    if (error instanceof InvalidRefreshTokenError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("[mobile api] refresh failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
