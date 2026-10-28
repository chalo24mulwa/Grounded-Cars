import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loginSchema } from "@/server/validation/user-schema";
import { loginWithCredentials, MobileAuthNotConfiguredError } from "@/server/mobile/mobile-auth";
import { checkRateLimit, RateLimitError } from "@/server/services/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const ip = await getClientIp();
    // Same key shape as the website's login rate limit (auth-actions.ts) —
    // a mobile-vs-web brute-force attempt against one account shares one
    // budget, not two.
    checkRateLimit(`login:${ip}:${email}`, { max: 8, windowMs: 15 * 60 * 1000 });

    const tokens = await loginWithCredentials(email, password, req.headers.get("user-agent") ?? undefined);
    return NextResponse.json(tokens);
  } catch (error) {
    if (error instanceof MobileAuthNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    // InvalidCredentialsError and anything else: deliberately a generic
    // 401, same "don't reveal which part was wrong" posture as the
    // website's Credentials provider (auth.ts's authorize() returns null
    // either way).
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
}
