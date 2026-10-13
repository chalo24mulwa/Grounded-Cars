import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { AuthenticationError, AuthorizationError } from "@/server/authorization/ownership";
import { InvalidStatusTransitionError } from "@/server/services/listing-status";
import { InvalidImageError } from "@/lib/storage";
import { RateLimitError } from "@/server/services/rate-limit";

// Shared by the fast-submit API routes: same user-facing messages as the
// listing server actions (listing-actions.ts toUserSafeError).
export function errorResponse(error: unknown) {
  let message = "Something went wrong. Please try again, or contact support if this continues.";
  let status = 500;
  if (error instanceof AuthenticationError) [message, status] = ["Please sign in and try again.", 401];
  else if (error instanceof AuthorizationError) [message, status] = [error.message, 403];
  else if (error instanceof InvalidStatusTransitionError) [message, status] = [error.message, 409];
  else if (error instanceof InvalidImageError) [message, status] = [error.message, 400];
  else if (error instanceof RateLimitError) [message, status] = [error.message, 429];
  else if (error instanceof ZodError) [message, status] = [error.errors[0]?.message ?? "Some fields are invalid. Please check and try again.", 400];
  else console.error("Unhandled error in fast listing submit:", error);
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Only requests coming from this site's own pages are accepted. */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin requests may omit it
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
