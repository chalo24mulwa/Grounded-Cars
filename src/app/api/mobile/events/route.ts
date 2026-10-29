import { NextResponse } from "next/server";
import { getPublishedEvents } from "@/server/services/event-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET() {
  try {
    const events = await getPublishedEvents();
    return NextResponse.json(events, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
