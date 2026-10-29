import { NextResponse, type NextRequest } from "next/server";
import { setServicePublished } from "@/server/services/service-catalog-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      const body = await req.json();
      const service = await setServicePublished(id, Boolean(body.published));
      return NextResponse.json(service);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
