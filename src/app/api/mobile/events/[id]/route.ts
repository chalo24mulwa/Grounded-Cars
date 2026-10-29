import { NextResponse } from "next/server";
import { getPublishedEventById } from "@/server/services/event-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = await getPublishedEventById(id);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json(event, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
