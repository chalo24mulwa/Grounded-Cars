import { NextResponse, type NextRequest } from "next/server";
import { getInsurancePolicyForAdmin, updateInsurancePolicy } from "@/server/services/insurance-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const policy = await getInsurancePolicyForAdmin(id);
      return NextResponse.json(policy);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

function textField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// multipart/form-data: title, description, startingPrice (as a STRING),
// plus an optional "image" file field to replace the policy's photo.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const formData = await req.formData();
      const input = {
        title: textField(formData, "title"),
        description: textField(formData, "description"),
        startingPrice: textField(formData, "startingPrice"),
      };
      const image = formData.get("image");
      const policy = await updateInsurancePolicy(id, input, image instanceof File ? image : null);
      return NextResponse.json(policy);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
