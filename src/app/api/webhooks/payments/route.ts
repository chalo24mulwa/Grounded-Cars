import { NextResponse, type NextRequest } from "next/server";
import { parseStkCallback } from "@/lib/mpesa";
import { handleMpesaCallback } from "@/server/services/featured-service";
import { handleCsrDonationCallback } from "@/server/services/csr-service";
import { handleServiceOrderCallback } from "@/server/services/service-catalog-service";
import { handleInsurancePurchaseCallback } from "@/server/services/insurance-service";

// M-Pesa Daraja's STK Push callback. Lives on a plain Route Handler (not a
// Server Action) because the caller is Safaricom's servers, not the
// browser — there's no session, no CSRF token, nothing a Server Action
// would give us here.
//
// Security model (Daraja sends no signature or custom headers, unlike
// Stripe-style webhooks):
//   1. A random secret in the callback URL's ?token= query param — the
//      exact URL only Safaricom (and us) knows, generated from
//      MPESA_CALLBACK_SECRET (see mpesa.ts's initiateStkPush).
//   2. Every payload is matched to a PaymentTransaction we ourselves
//      created (by CheckoutRequestID) before anything is trusted — an
//      unmatched CheckoutRequestID is silently ignored, never blindly
//      applied.
//   3. handleMpesaCallback() is idempotent — a retried/duplicate callback
//      for an already-processed transaction is a no-op.
//
// The featured-listing, CSR-donation, service-order, and insurance-purchase
// flows all share this one callback URL (initiateStkPush's CallBackURL
// always points here, regardless of which Till the push was sent from) —
// so a callback is tried against featured-service.ts's handler first, then
// CSR's, then service orders', then insurance purchases' last, each only
// attempted if the previous one didn't recognize the CheckoutRequestID.
// The four tables' providerTransactionId columns are independently
// @unique, and Daraja's CheckoutRequestIDs are globally unique GUIDs, so
// there's no realistic collision between the lookups.
//
// Always return 200 quickly, even for a token mismatch or unmatched
// transaction — Daraja retries failed-looking callbacks, and retries can't
// fix "unknown request," so acknowledging (without acting on it) is the
// correct response.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.MPESA_CALLBACK_SECRET) {
    console.warn("Rejected payment webhook call with an invalid/missing token.");
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const callback = parseStkCallback(body);
  if (!callback) {
    console.warn("Payment webhook received a payload with no recognizable stkCallback.");
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  try {
    const featuredResult = await handleMpesaCallback(callback);
    if (!featuredResult.matched) {
      const csrResult = await handleCsrDonationCallback(callback);
      if (!csrResult.matched) {
        const serviceResult = await handleServiceOrderCallback(callback);
        if (!serviceResult.matched) {
          await handleInsurancePurchaseCallback(callback);
        }
      }
    }
  } catch (error) {
    // Log server-side for investigation, but still ack — Safaricom isn't
    // going to fix an internal error of ours by retrying the same payload.
    console.error("Failed to process M-Pesa callback:", error);
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
