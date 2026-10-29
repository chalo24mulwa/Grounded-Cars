import { NextResponse, type NextRequest } from "next/server";
import { getAllCsrInitiativesForAdmin, createCsrInitiative } from "@/server/services/csr-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
      const result = await getAllCsrInitiativesForAdmin({ page });
      return NextResponse.json(result);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

// multipart/form-data: title, summary, story, targetAmount, startDate?,
// endDate? as text fields (createCsrInitiativeSchema transforms the raw
// strings itself), plus an optional "cover" file field.
function textField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalTextField(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value ? value : undefined;
}

export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const formData = await req.formData();
      const input = {
        title: textField(formData, "title"),
        summary: textField(formData, "summary"),
        story: textField(formData, "story"),
        targetAmount: textField(formData, "targetAmount"),
        startDate: optionalTextField(formData, "startDate"),
        endDate: optionalTextField(formData, "endDate"),
      };
      const cover = formData.get("cover");
      const initiative = await createCsrInitiative(input, cover instanceof File ? cover : null);
      return NextResponse.json(initiative, { status: 201 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
