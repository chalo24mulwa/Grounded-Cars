import { NextResponse, type NextRequest } from "next/server";
import { getAllServicesForAdmin, createService } from "@/server/services/service-catalog-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const services = await getAllServicesForAdmin();
      return NextResponse.json(services);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

// Body: { slug: one of the 5 fixed SERVICE_PAGE_OPTIONS, title, description,
// price }. price is a STRING (createServiceSchema's moneyString transform
// expects the raw form-string shape, e.g. "25000"), not a number.
export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const body = await req.json();
      const service = await createService(body);
      return NextResponse.json(service, { status: 201 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
