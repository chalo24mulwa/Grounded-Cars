import { NextResponse, type NextRequest } from "next/server";
import { initiateInsurancePurchase } from "@/server/services/insurance-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Public — no account required. Body: { policyId, customerPhone,
// customerName?, customerEmail? }. Returns { purchaseId }. Amount is always
// server-derived from the policy's own startingPrice, never client input.
// Same static-confirmation, no-polling pattern as CSR/Services.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await initiateInsurancePurchase(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
