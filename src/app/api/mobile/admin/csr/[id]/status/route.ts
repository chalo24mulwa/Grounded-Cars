import { NextResponse, type NextRequest } from "next/server";
import { setCsrInitiativeStatus } from "@/server/services/csr-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Body: { status: "ACTIVE" | "COMPLETED" }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const initiative = await setCsrInitiativeStatus(id, body.status);
      return NextResponse.json(initiative);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
