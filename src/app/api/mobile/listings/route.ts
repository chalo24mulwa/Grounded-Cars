import { NextResponse, type NextRequest } from "next/server";
import { getPublicListings } from "@/server/services/listing-service";
import { parseListingSearchParams } from "@/server/validation/search-schema";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Public — no auth. Same getPublicListings()/parseListingSearchParams() the
// website's /cars page and homepage use, so "a listing edited on the
// website shows up identically here" is true by construction, not by
// keeping two queries in sync by hand.
export async function GET(req: NextRequest) {
  try {
    const raw: Record<string, string | string[]> = {};
    for (const key of req.nextUrl.searchParams.keys()) {
      const values = req.nextUrl.searchParams.getAll(key);
      raw[key] = values.length > 1 ? values : values[0]!;
    }

    const filters = parseListingSearchParams(raw);
    const result = await getPublicListings(filters);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
