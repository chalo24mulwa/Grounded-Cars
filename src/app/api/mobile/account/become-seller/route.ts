import { NextResponse, type NextRequest } from "next/server";
import { becomeSeller } from "@/server/services/auth-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const updated = await becomeSeller();
      return NextResponse.json(updated);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
