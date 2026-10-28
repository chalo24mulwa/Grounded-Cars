import { NextResponse } from "next/server";
import { getDistinctLocations } from "@/server/services/listing-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET() {
  try {
    const locations = await getDistinctLocations();
    return NextResponse.json(locations, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
