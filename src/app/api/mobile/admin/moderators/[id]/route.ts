import { NextResponse, type NextRequest } from "next/server";
import { deleteModeratorAccount } from "@/server/services/admin-service";
import { withMobileAuth, mobileErrorResponse } from "@/server/mobile/with-mobile-auth";

// ADMIN only. Refuses (throws ModeratorHasActivityError, caught by the
// generic Error handler below) if the moderator has any listings/
// inquiries/payments/subscriptions.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withMobileAuth(req, async () => {
    try {
      const { id } = await params;
      await deleteModeratorAccount(id);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return mobileErrorResponse(error);
    }
  });
}
