import { NextResponse } from "next/server";
import { getPublishedCsrInitiativeBySlug } from "@/server/services/csr-service";
import { mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const initiative = await getPublishedCsrInitiativeBySlug(slug);
    if (!initiative) return NextResponse.json({ error: "Initiative not found." }, { status: 404 });
    return NextResponse.json(initiative, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return mobileErrorResponse(error);
  }
}
