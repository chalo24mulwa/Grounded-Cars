import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

// Shared shell for every /dashboard* route. Centralizes the
// auth+role redirect so new dashboard pages get it for free — this is
// still just the first line of defense, not the authorization boundary
// itself: every service function underneath (getMyListings,
// requireListingOwnership, etc.) re-verifies independently, so this layout
// being bypassed or misconfigured can't expose another seller's data.
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (
    session.user.role !== "SELLER" &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "MODERATOR"
  ) {
    redirect("/account?error=forbidden");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-6 md:flex-row">
        <DashboardNav role={session.user.role} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
