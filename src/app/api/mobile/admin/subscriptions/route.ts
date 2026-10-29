import { NextResponse, type NextRequest } from "next/server";
import { getAllSubscriptionsForAdmin } from "@/server/services/featured-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";
import type { FeaturedSubscriptionStatus } from "@prisma/client";

const VALID_STATUSES: FeaturedSubscriptionStatus[] = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
  "PAYMENT_FAILED",
];

// Read-only admin view — query params ?status=&page=. No edit/delete
// action exists for subscriptions anywhere, website included (payment
// records are never hand-edited — see featured-service.ts's own comment).
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const statusParam = req.nextUrl.searchParams.get("status");
      const status = VALID_STATUSES.includes(statusParam as FeaturedSubscriptionStatus)
        ? (statusParam as FeaturedSubscriptionStatus)
        : undefined;
      const pageParam = Number(req.nextUrl.searchParams.get("page"));
      const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

      const result = await getAllSubscriptionsForAdmin({ status, page });
      return NextResponse.json(result);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
