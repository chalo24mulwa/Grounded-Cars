import { NextResponse, type NextRequest } from "next/server";
import { initiateCsrDonation } from "@/server/services/csr-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Public — no account required (the website's donate flow is anonymous
// too). Body: { initiativeId, amount, donorPhone, donorName?, donorEmail? }.
// Returns { donationId }. An STK push was just sent to donorPhone; there is
// no status-polling endpoint for this (same as the website — the donation
// completes asynchronously via the M-Pesa webhook, and the initiative's
// amountRaised updates whenever the donor next views the page).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await initiateCsrDonation(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
