import { auth } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { UtilityBarNav } from "@/components/layout/UtilityBarNav";

// A slim, always-visible strip above the main header — sticky the same way
// the header is (top-0, above it in the stack), so the header's own sticky
// offset is shifted down by this bar's height (see SiteHeader.tsx) rather
// than the two overlapping. Present site-wide (mounted once in the root
// layout), same pattern as SiteHeader/SiteFooter.
export async function UtilityBar() {
  const session = await auth();

  const displayPhone = siteConfig.contactPhone.replace(/^\+254/, "0");

  // "List Car" (mobile only — see UtilityBarNav) uses the exact same
  // role-aware destination as the homepage hero's "List Your Car" and the
  // header's "Sell a Car": staff go straight to the listing form, a signed-in
  // buyer upgrades first, a signed-out visitor logs in first.
  const listCarHref =
    session?.user && (session.user.role === "SELLER" || session.user.role === "ADMIN" || session.user.role === "MODERATOR")
      ? "/dashboard/listings/new"
      : !session?.user
        ? `/login?callbackUrl=${encodeURIComponent("/account?autoSeller=1")}`
        : undefined;

  return (
    // Light grey bar — link text is dark slate by default, with a distinct
    // active state (solid brand-accent pill, same "you are here" signal
    // DashboardNav/AdminNav already use) and a subtle hover wash otherwise.
    // See UtilityBarNav for the interactive states themselves — split out
    // so it can read the current route via usePathname().
    <div className="sticky top-0 z-50 w-full bg-gray-200 text-slate-700">
      <UtilityBarNav
        contactPhone={siteConfig.contactPhone}
        displayPhone={displayPhone}
        listCarHref={listCarHref}
      />
    </div>
  );
}
