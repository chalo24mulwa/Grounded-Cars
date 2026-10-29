import { NextResponse, type NextRequest } from "next/server";
import { getAllEventsForAdmin, createEvent } from "@/server/services/event-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
      const result = await getAllEventsForAdmin({ page });
      return NextResponse.json(result);
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

// multipart/form-data: title, description, location?, eventDate? as text
// fields, plus an optional "image" file field.
export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const formData = await req.formData();
      const input = {
        title: textField(formData, "title"),
        description: textField(formData, "description"),
        location: optionalTextField(formData, "location"),
        eventDate: optionalTextField(formData, "eventDate"),
        eventTime: optionalTextField(formData, "eventTime"),
      };
      const image = formData.get("image");
      const event = await createEvent(input, image instanceof File ? image : null);
      return NextResponse.json(event, { status: 201 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
