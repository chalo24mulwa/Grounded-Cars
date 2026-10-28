import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { verifyMobileAccessToken } from "@/server/mobile/mobile-auth";
import { mobileSessionContext } from "@/server/authorization/mobile-session-context";
import {
  AuthenticationError,
  AuthorizationError,
  AccountSuspendedError,
} from "@/server/authorization/ownership";
import { RateLimitError } from "@/server/services/rate-limit";
import { ZodError } from "zod";

/**
 * Every authenticated src/app/api/mobile/** route wraps its handler in this.
 * It verifies the Bearer access token, then runs the handler inside
 * mobileSessionContext so requireAuth()/requireRole()/requireListingOwnership
 * (ownership.ts) resolve this caller's identity instead of calling auth() —
 * meaning the handler can call the exact same service functions the website
 * uses and inherit the exact same authorization guarantees, with no
 * duplicated ownership/role-check logic in this file or any route.
 */
export async function withMobileAuth(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<Response>
): Promise<Response> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyMobileAccessToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return mobileSessionContext.run(user, () => handler(req));
}

/**
 * Shared error → JSON mapping for every src/app/api/mobile/** route
 * (authenticated or not) — the same error classes every server action in
 * the app already throws, just mapped to HTTP status instead of a form
 * error string.
 */
export function mobileErrorResponse(error: unknown): Response {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof AccountSuspendedError || error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof RateLimitError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request.", details: error.flatten() }, { status: 400 });
  }
  if (error instanceof Error) {
    // Every domain error class in the app (EmailAlreadyRegisteredError,
    // ListingNotFoundError, InvalidCredentialsError, etc.) already carries
    // a user-safe message — same trust boundary the website's own
    // toUserSafeError()-style mapping relies on elsewhere.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[mobile api] unexpected error:", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
