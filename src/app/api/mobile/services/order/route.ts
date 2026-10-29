import { NextResponse, type NextRequest } from "next/server";
import { initiateServiceOrder } from "@/server/services/service-catalog-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Public — no account required. Body: { serviceId, customerPhone,
// customerName?, customerEmail?, couponCode? }. Returns { orderId, free }.
// Same "no status-polling endpoint, static confirmation message" pattern as
// CSR donations — there is no "my orders" page anywhere on the website
// either.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await initiateServiceOrder(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
