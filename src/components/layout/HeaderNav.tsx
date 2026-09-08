"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { logoutAction } from "@/server/actions/auth-actions";
import { OurServicesDropdown } from "@/components/layout/OurServicesDropdown";
import { FindACarDropdown, type CategoryCount } from "@/components/layout/FindACarDropdown";
import { BecomeSellerButton } from "@/components/auth/BecomeSellerButton";
import type { UserRole } from "@prisma/client";

// Split out from SiteHeader.tsx (a server component, for session access)
// purely so this can read the current route via usePathname() for
// active-state highlighting — same split used for the utility bar (see
// UtilityBarNav.tsx). `role` is undefined when signed out; the header's
// existing role-gated branches (Sell a Car / Dashboard / Admin /
// Favorites+Account+Logout vs. Login+Register) are otherwise unchanged.
const LINK_CLASS = "transition";
// Distinct from the existing hover color (text-brand, green) so a link
// that's both hovered AND the current page still reads as "active" first —
// brand-accent is the palette's own "highlights/warm CTAs" color (see
// tailwind.config.ts), the same one UtilityBarNav uses for its active pill.
const ACTIVE_CLASS = "text-brand-accent font-semibold";
const INACTIVE_CLASS = "text-slate-600 hover:text-brand";

function navLinkClass(active: boolean) {
  return clsx(LINK_CLASS, active ? ACTIVE_CLASS : INACTIVE_CLASS);
}

export function HeaderNav({
  role,
  categoryCounts,
  totalListingCount,
}: {
  role?: UserRole;
  // Server-fetched (SiteHeader.tsx → getCategoryCounts()) and threaded
  // through as plain props — this component and FindACarDropdown itself
  // never query the database directly.
  categoryCounts: CategoryCount[];
  totalListingCount: number;
}) {
  const pathname = usePathname();
  const isStaffish = role === "SELLER" || role === "ADMIN" || role === "MODERATOR";

  return (
    <nav className="flex flex-wrap items-center gap-[18px] text-sm font-medium">
      <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={navLinkClass(pathname === "/")}>
        Home
      </Link>
      <FindACarDropdown categories={categoryCounts} totalCount={totalListingCount} />
      {role ? (
        isStaffish ? (
          <Link
            href="/dashboard/listings/new"
            aria-current={pathname === "/dashboard/listings/new" ? "page" : undefined}
            className={navLinkClass(pathname === "/dashboard/listings/new")}
          >
            Sell a Car
          </Link>
        ) : (
          // A signed-in BUYER: upgrading to SELLER is a real mutation
          // (becomeSellerAction), so this has to be a form submit, not a
          // plain link — same reason "Log out" below is a form too. Never
          // "active": clicking it always navigates away immediately.
          <BecomeSellerButton
            redirectTo="/dashboard/listings/new"
            label="Sell a Car"
            pendingLabel="Setting up…"
            className={INACTIVE_CLASS}
          />
        )
      ) : (
        <Link
          href={`/login?callbackUrl=${encodeURIComponent("/account?autoSeller=1")}`}
          className={INACTIVE_CLASS}
        >
          Sell a Car
        </Link>
      )}
      <Link
        href="/best-deals"
        aria-current={pathname === "/best-deals" ? "page" : undefined}
        className={navLinkClass(pathname === "/best-deals")}
      >
        Best Deals
      </Link>
      <OurServicesDropdown />
      <Link
        href="/events"
        aria-current={pathname.startsWith("/events") ? "page" : undefined}
        className={navLinkClass(pathname.startsWith("/events"))}
      >
        Events
      </Link>
      <Link
        href="/about-us"
        aria-current={pathname === "/about-us" ? "page" : undefined}
        className={navLinkClass(pathname === "/about-us")}
      >
        About Us
      </Link>
      {role ? (
        <>
          <Link
            href="/favorites"
            aria-current={pathname === "/favorites" ? "page" : undefined}
            className={navLinkClass(pathname === "/favorites")}
          >
            Favorites
          </Link>
          <Link
            href="/account"
            aria-current={pathname === "/account" ? "page" : undefined}
            className={navLinkClass(pathname === "/account")}
          >
            Account
          </Link>
          {isStaffish && (
            <Link
              href="/dashboard"
              aria-current={pathname.startsWith("/dashboard") ? "page" : undefined}
              className={navLinkClass(pathname.startsWith("/dashboard"))}
            >
              Dashboard
            </Link>
          )}
          {role === "ADMIN" && (
            <Link
              href="/admin"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className={navLinkClass(pathname.startsWith("/admin"))}
            >
              Admin
            </Link>
          )}
          <form action={logoutAction}>
            <button type="submit" className={INACTIVE_CLASS}>
              Log out
            </button>
          </form>
        </>
      ) : (
        <>
          <Link
            href="/login"
            aria-current={pathname === "/login" ? "page" : undefined}
            className={navLinkClass(pathname === "/login")}
          >
            Log in
          </Link>
          <Link
            href="/register"
            className={clsx(
              "rounded-md px-3 py-1.5 text-white transition",
              pathname === "/register" ? "bg-brand-accent hover:bg-brand-accent/90" : "bg-brand hover:bg-brand/90"
            )}
          >
            Register
          </Link>
        </>
      )}
    </nav>
  );
}
