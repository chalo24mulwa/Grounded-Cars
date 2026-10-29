import { NextResponse } from "next/server";
import { getPublishedCsrInitiatives } from "@/server/services/csr-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET() {
  try {
    const initiatives = await getPublishedCsrInitiatives();
    return NextResponse.json(initiatives, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
