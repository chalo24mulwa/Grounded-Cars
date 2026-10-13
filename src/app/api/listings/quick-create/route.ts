import { NextResponse, type NextRequest } from "next/server";
import { quickCreateListing } from "@/server/services/listing-fast-submit";
import { errorResponse, isSameOrigin } from "@/server/services/listing-fast-submit-http";
import { parseListingFields } from "@/server/validation/listing-form-fields";
import type { CreateListingInput } from "@/server/validation/listing-schema";

// "Submit" / "Save as Draft" on the Add New Car form (see
// listing-fast-submit.ts). Answers within a fraction of a second; the
// listing is saved in the background even if the seller has already left.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = (await request.json()) as {
      fields?: Record<string, unknown>;
      intent?: string;
      pending?: { pid?: unknown; pidSig?: unknown } | null;
      photoTokens?: unknown;
    };
    const pending =
      body.pending && typeof body.pending.pid === "string" && typeof body.pending.pidSig === "string"
        ? { pid: body.pending.pid, pidSig: body.pending.pidSig }
        : null;
    const photoTokens = Array.isArray(body.photoTokens) ? body.photoTokens.filter((t): t is string => typeof t === "string") : [];
    const intent = body.intent === "submit" ? "submit" : "draft";
    const { id } = await quickCreateListing({ input: parseListingFields(body.fields ?? {}) as CreateListingInput, intent, pending, photoTokens });
    const redirectTo = intent === "submit" ? `/dashboard/listings/${id}/submitted` : `/dashboard/listings/${id}/edit?created=1`;
    return NextResponse.json({ id, redirectTo }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
