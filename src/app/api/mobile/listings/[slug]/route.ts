import { NextResponse } from "next/server";
import { getPublicListingBySlug } from "@/server/services/listing-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const listing = await getPublicListingBySlug(slug);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }
    return NextResponse.json(listing, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
