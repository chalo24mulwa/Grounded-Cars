import { NextResponse, type NextRequest } from "next/server";
import { stagePhoto, unstagePhoto } from "@/server/services/listing-fast-submit";
import { errorResponse, isSameOrigin } from "@/server/services/listing-fast-submit-http";

// Uploads one photo for the "Add New Car" form the moment it's picked (see
// listing-fast-submit.ts), so Submit doesn't have to wait for photos.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Please choose an image to upload." }, { status: 400 });
    }
    const pid = form.get("pid");
    const pidSig = form.get("pidSig");
    const pending = typeof pid === "string" && typeof pidSig === "string" && pid && pidSig ? { pid, pidSig } : null;
    const result = await stagePhoto(file, pending);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { token } = (await request.json()) as { token?: unknown };
    if (typeof token !== "string") return NextResponse.json({ error: "Invalid photo." }, { status: 400 });
    await unstagePhoto(token);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
