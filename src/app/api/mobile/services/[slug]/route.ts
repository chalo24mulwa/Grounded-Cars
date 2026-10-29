import { NextResponse } from "next/server";
import { getPublishedServiceBySlug } from "@/server/services/service-catalog-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// slug is one of the five fixed SERVICE_PAGE_OPTIONS (service-schema.ts):
// pre-purchase-inspection, car-financing, car-valuation, car-tracking,
// home-repairs. Returns null (404 here) if an admin hasn't created/
// published a catalog entry for that slug yet.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const service = await getPublishedServiceBySlug(slug);
    if (!service) return NextResponse.json({ error: "This service isn't available yet." }, { status: 404 });
    return NextResponse.json(service, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
