import { NextResponse, type NextRequest } from "next/server";
import { revokeMobileRefreshToken } from "@/server/mobile/mobile-auth";

// Always resolves 204, even for an already-invalid/unknown token — logging
// out is a success from the client's point of view either way (see
// revokeMobileRefreshToken's own comment).
export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (typeof refreshToken === "string" && refreshToken) {
      await revokeMobileRefreshToken(refreshToken);
    }
  } catch (error) {
    console.error("[mobile api] logout failed:", error);
  }
  return new NextResponse(null, { status: 204 });
}
