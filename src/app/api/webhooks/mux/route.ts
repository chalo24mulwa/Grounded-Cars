import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/trending/mux";
import { isTrendingEnabled } from "@/lib/trending/config";
import { handleMuxWebhookEvent } from "@/server/services/trending/video-service";

// Mux → us: "upload received", "video ready", "processing failed". Only
// accepted with a valid `mux-signature` (HMAC with MUX_WEBHOOK_SECRET); even
// then the payload is only used to find our video — its real state is read
// back from Mux's API (see syncVideoWithMux), never trusted from the body.
export async function POST(request: NextRequest) {
  if (!isTrendingEnabled()) return NextResponse.json({ ok: true, ignored: "disabled" });

  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, request.headers.get("mux-signature"))) {
    console.warn("Rejected Mux webhook with a missing or invalid signature.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Parameters<typeof handleMuxWebhookEvent>[0];
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleMuxWebhookEvent(event);
  } catch (error) {
    // 500 makes Mux retry later, which is what we want for a transient error.
    console.error("Failed to process Mux webhook:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
