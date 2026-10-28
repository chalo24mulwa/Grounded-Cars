import { NextResponse, type NextRequest } from "next/server";
import { registerUser, EmailAlreadyRegisteredError } from "@/server/services/auth-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";
import { loginWithCredentials } from "@/server/mobile/mobile-auth";
import { checkRateLimit, RateLimitError } from "@/server/services/rate-limit";
import { getClientIp } from "@/lib/request-ip";

// Same registerUser() the website's register form submits to — role is
// always BUYER, never accepted from the request body (see auth-service.ts).
// Logs the new account straight in (mints a mobile token pair) rather than
// making the client immediately call /login again with the same password
// it just submitted.
export async function POST(req: NextRequest) {
  try {
    const ip = await getClientIp();
    checkRateLimit(`mobile-register:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 });

    const body = await req.json();
    await registerUser(body);
    const tokens = await loginWithCredentials(body.email, body.password, req.headers.get("user-agent") ?? undefined);
    return NextResponse.json(tokens, { status: 201 });
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return mobileErrorResponse(error);
  }
}
