import { NextResponse, type NextRequest } from "next/server";
import { getServiceForAdmin, updateService } from "@/server/services/service-catalog-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const service = await getServiceForAdmin(id);
      return NextResponse.json(service);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

// Body: { title, description, price (as a STRING) }. slug is fixed at
// creation and never editable here (updateServiceSchema omits it).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const service = await updateService(id, body);
      return NextResponse.json(service);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
