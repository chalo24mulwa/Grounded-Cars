import { NextResponse, type NextRequest } from "next/server";
import { requestPasswordReset } from "@/server/services/password-reset-service";
import { checkRateLimit, RateLimitError } from "@/server/services/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Deliberately resolves the same way whether or not the email belongs to an
// account — requestPasswordReset() itself already guarantees this (see its
// own comment in password-reset-service.ts), so this route doesn't need to
// add anything on top to avoid leaking which emails are registered.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ip = await getClientIp();
    checkRateLimit(`reset-request:${ip}:${body?.email}`, { max: 5, windowMs: 15 * 60 * 1000 });

    await requestPasswordReset(body);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return mobileErrorResponse(error);
  }
}
