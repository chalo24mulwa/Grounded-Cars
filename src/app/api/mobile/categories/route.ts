import { NextResponse } from "next/server";
import { getCategoryCounts, CATEGORY_LABELS } from "@/server/services/listing-service";
import { CLASSIFICATIONS } from "@/server/validation/search-schema";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET() {
  try {
    const counts = await getCategoryCounts();
    return NextResponse.json(
      { counts, labels: CATEGORY_LABELS, classifications: CLASSIFICATIONS },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
