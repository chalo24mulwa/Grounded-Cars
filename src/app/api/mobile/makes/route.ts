import { NextResponse } from "next/server";
import { getMakeModelIndex } from "@/server/services/listing-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET() {
  try {
    const makes = await getMakeModelIndex();
    return NextResponse.json(makes, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
