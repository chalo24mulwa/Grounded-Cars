import { NextResponse } from "next/server";
import { getPublishedInsurancePolicyById } from "@/server/services/insurance-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const policy = await getPublishedInsurancePolicyById(id);
    if (!policy) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    return NextResponse.json(policy, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
