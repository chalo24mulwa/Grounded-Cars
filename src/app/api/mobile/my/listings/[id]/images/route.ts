import { NextResponse, type NextRequest } from "next/server";
import { addListingImages } from "@/server/services/listing-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// multipart/form-data upload, one or more files under the "files" field —
// same addListingImages() the website's photo-upload form submits to (same
// watermark/resize pipeline, same MAX_IMAGES_PER_LISTING cap, same
// ownership check). The 50mb body-size allowance is the same
// middlewareClientMaxBodySize/serverActions.bodySizeLimit next.config.mjs
// already sets for the website's own multi-photo listing form.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const formData = await req.formData();
      const files = formData.getAll("files").filter((f): f is File => f instanceof File);
      if (files.length === 0) {
        return NextResponse.json({ error: "No photos were attached." }, { status: 400 });
      }
      await addListingImages(id, files);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
