import { NextResponse, type NextRequest } from "next/server";
import { setEventPublished } from "@/server/services/event-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const event = await setEventPublished(id, Boolean(body.published));
      return NextResponse.json(event);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
