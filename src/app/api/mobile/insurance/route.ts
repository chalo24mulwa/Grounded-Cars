import { NextResponse } from "next/server";
import { getPublishedInsurancePolicies } from "@/server/services/insurance-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET() {
  try {
    const policies = await getPublishedInsurancePolicies();
    return NextResponse.json(policies, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
