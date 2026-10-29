import { NextResponse, type NextRequest } from "next/server";
import { setFeaturedPlanActive } from "@/server/services/featured-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Body: { active: boolean }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const plan = await setFeaturedPlanActive(id, Boolean(body.active));
      return NextResponse.json(plan);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
