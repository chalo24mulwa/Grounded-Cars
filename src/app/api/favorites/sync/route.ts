import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncFavoritesCookie } from "@/server/services/favorite-service";

// Writes the signed-in visitor's saved-car ids into their cookie (see
// favorite-service.ts) the first time a page notices it's missing, e.g.
// right after logging in. Only ever touches the caller's own cookie.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 204 });
  try {
    await syncFavoritesCookie(session.user.id);
  } catch (error) {
    console.error("[favorites] sync failed:", error);
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
