import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserProfile, updateProfile } from "@/server/services/auth-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// Same getCurrentUserProfile()/updateProfile() the website's /account page
// uses — this is the mobile "My Account" screen's data source.
export async function GET(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const profile = await getCurrentUserProfile();
      return NextResponse.json(profile);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}

export async function PATCH(req: NextRequest) {
  return withMobileAuth(req, async () => {
    try {
      const body = await req.json();
      const profile = await updateProfile(body);
      return NextResponse.json(profile);
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
