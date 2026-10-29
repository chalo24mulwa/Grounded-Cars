import { NextResponse, type NextRequest } from "next/server";
import { getCsrInitiativeForAdmin, updateCsrInitiative } from "@/server/services/csr-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const initiative = await getCsrInitiativeForAdmin(id);
      return NextResponse.json(initiative);
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

// multipart/form-data, same fields as POST /api/mobile/admin/csr, plus an
// optional "cover" file field to replace the cover photo.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
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
      const initiative = await updateCsrInitiative(id, input, cover instanceof File ? cover : null);
      return NextResponse.json(initiative);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
