import { NextResponse, type NextRequest } from "next/server";
import { getEventForAdmin, updateEvent } from "@/server/services/event-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const event = await getEventForAdmin(id);
      return NextResponse.json(event);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

function textField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalTextField(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value ? value : undefined;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const formData = await req.formData();
      const input = {
        title: textField(formData, "title"),
        description: textField(formData, "description"),
        location: optionalTextField(formData, "location"),
        eventDate: optionalTextField(formData, "eventDate"),
        eventTime: optionalTextField(formData, "eventTime"),
      };
      const image = formData.get("image");
      const event = await updateEvent(id, input, image instanceof File ? image : null);
      return NextResponse.json(event);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
