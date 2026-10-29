import { NextResponse, type NextRequest } from "next/server";
import { addServiceImage } from "@/server/services/service-catalog-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// multipart/form-data, one file under the "file" field.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No photo was attached." }, { status: 400 });
      }
      const image = await addServiceImage(id, file);
      return NextResponse.json(image, { status: 201 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
