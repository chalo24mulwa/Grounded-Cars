import { NextResponse, type NextRequest } from "next/server";
import { setCsrInitiativePublished } from "@/server/services/csr-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const initiative = await setCsrInitiativePublished(id, Boolean(body.published));
      return NextResponse.json(initiative);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
