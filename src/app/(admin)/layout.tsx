import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";

// Shared shell for every /admin* route. Centralizes the auth+role redirect
// so new admin pages get it for free — same pattern as (seller)/layout.tsx.
// Still just the first line of defense, not the authorization boundary
// itself: every service function underneath calls requireRole("ADMIN")
// independently, so this layout being bypassed or misconfigured can't
// expose admin-only data. Middleware (src/middleware.ts) is the third,
// Edge-level layer ahead of this.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/account?error=forbidden");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <AdminNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
