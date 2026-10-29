import { NextResponse, type NextRequest } from "next/server";
import {
  startFeatureSubscription,
  ListingNotActiveError,
  PlanNotFoundError,
} from "@/server/services/featured-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Body: { listingId, planId, phoneNumber, couponCode? }. Returns
// { subscriptionId, paymentId, free }. A 100%-off coupon activates
// immediately (free:true); otherwise an STK push was just sent to
// phoneNumber and the subscription stays PENDING until the M-Pesa webhook
// confirms it (poll GET /api/mobile/my/featured-subscriptions — same
// "no dedicated status endpoint, just refetch the list" pattern the
// website's own SubscriptionHistory component uses).
export async function POST(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const body = await req.json();
      const result = await startFeatureSubscription(body);
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof ListingNotActiveError || error instanceof PlanNotFoundError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return mobileErrorResponse(error);
    }
  });
}
