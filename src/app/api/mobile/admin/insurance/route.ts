import { NextResponse, type NextRequest } from "next/server";
import { getAllInsurancePoliciesForAdmin, createInsurancePolicy } from "@/server/services/insurance-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
      const result = await getAllInsurancePoliciesForAdmin({ page });
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

// multipart/form-data: title, description, startingPrice (as a STRING) text
// fields, plus an optional "image" file field.
export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const formData = await req.formData();
      const input = {
        title: textField(formData, "title"),
        description: textField(formData, "description"),
        startingPrice: textField(formData, "startingPrice"),
      };
      const image = formData.get("image");
      const policy = await createInsurancePolicy(input, image instanceof File ? image : null);
      return NextResponse.json(policy, { status: 201 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
