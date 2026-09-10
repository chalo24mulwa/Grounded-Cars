"use client";

import { useEffect, useState } from "react";
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
// Below `md` the same links render stacked full-width inside the mobile
// dropdown panel instead of a horizontal row — bigger tap targets and a
// divider between rows so it reads as a list, not a squeezed-down copy of
// the desktop nav.
const MOBILE_LINK_CLASS = "block border-b border-slate-100 px-4 py-3 text-base transition";
// Distinct from the existing hover color (text-brand, green) so a link
// that's both hovered AND the current page still reads as "active" first —
// brand-accent is the palette's own "highlights/warm CTAs" color (see
// tailwind.config.ts), the same one UtilityBarNav uses for its active pill.
const ACTIVE_CLASS = "text-brand-accent font-semibold";
const INACTIVE_CLASS = "text-slate-600 hover:text-brand";

function navLinkClass(active: boolean, mobile: boolean) {
  return clsx(mobile ? MOBILE_LINK_CLASS : LINK_CLASS, active ? ACTIVE_CLASS : INACTIVE_CLASS);
}

// Renders the actual link set once, shared between the desktop horizontal
// nav and the mobile dropdown panel — `mobile` only swaps classNames
// (stacked/full-width vs inline) and wires `onNavigate` so tapping a link
// closes the panel immediately instead of waiting for the route change to
// take effect.
function NavLinks({
  mobile,
  role,
  categoryCounts,
  totalListingCount,
  onNavigate,
}: {
  mobile: boolean;
  role?: UserRole;
  categoryCounts: CategoryCount[];
  totalListingCount: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isStaffish = role === "SELLER" || role === "ADMIN" || role === "MODERATOR";
  // FindACarDropdown/OurServicesDropdown/the logout form aren't plain
  // Links, so they can't take navLinkClass — wrapping them in the same
  // padded/divided row on mobile keeps them visually consistent with the
  // Link items around them instead of looking unstyled.
  const wrapMobile = (el: React.ReactNode) =>
    mobile ? <div className="border-b border-slate-100 px-4 py-3">{el}</div> : el;

  return (
    <>
      <Link
        href="/"
        onClick={onNavigate}
        aria-current={pathname === "/" ? "page" : undefined}
        className={navLinkClass(pathname === "/", mobile)}
      >
        Home
      </Link>
      {wrapMobile(<FindACarDropdown categories={categoryCounts} totalCount={totalListingCount} />)}
      {role ? (
        isStaffish ? (
          <Link
            href="/dashboard/listings/new"
            onClick={onNavigate}
            aria-current={pathname === "/dashboard/listings/new" ? "page" : undefined}
            className={navLinkClass(pathname === "/dashboard/listings/new", mobile)}
          >
            Sell a Car
          </Link>
        ) : (
          // A signed-in BUYER: upgrading to SELLER is a real mutation
          // (becomeSellerAction), so this has to be a form submit, not a
          // plain link — same reason "Log out" below is a form too. Never
          // "active": clicking it always navigates away immediately.
          wrapMobile(
            <BecomeSellerButton
              redirectTo="/dashboard/listings/new"
              label="Sell a Car"
              pendingLabel="Setting up…"
              className={mobile ? clsx(INACTIVE_CLASS, "text-base") : INACTIVE_CLASS}
            />
          )
        )
      ) : (
        <Link
          href={`/login?callbackUrl=${encodeURIComponent("/account?autoSeller=1")}`}
          onClick={onNavigate}
          className={navLinkClass(false, mobile)}
        >
          Sell a Car
        </Link>
      )}
      <Link
        href="/best-deals"
        onClick={onNavigate}
        aria-current={pathname === "/best-deals" ? "page" : undefined}
        className={navLinkClass(pathname === "/best-deals", mobile)}
      >
        Best Deals
      </Link>
      {wrapMobile(<OurServicesDropdown />)}
      <Link
        href="/events"
        onClick={onNavigate}
        aria-current={pathname.startsWith("/events") ? "page" : undefined}
        className={navLinkClass(pathname.startsWith("/events"), mobile)}
      >
        Events
      </Link>
      <Link
        href="/about-us"
        onClick={onNavigate}
        aria-current={pathname === "/about-us" ? "page" : undefined}
        className={navLinkClass(pathname === "/about-us", mobile)}
      >
        About Us
      </Link>
      {role ? (
        <>
          <Link
            href="/favorites"
            onClick={onNavigate}
            aria-current={pathname === "/favorites" ? "page" : undefined}
            className={navLinkClass(pathname === "/favorites", mobile)}
          >
            Favorites
          </Link>
          <Link
            href="/account"
            onClick={onNavigate}
            aria-current={pathname === "/account" ? "page" : undefined}
            className={navLinkClass(pathname === "/account", mobile)}
          >
            Account
          </Link>
          {isStaffish && (
            <Link
              href="/dashboard"
              onClick={onNavigate}
              aria-current={pathname.startsWith("/dashboard") ? "page" : undefined}
              className={navLinkClass(pathname.startsWith("/dashboard"), mobile)}
            >
              Dashboard
            </Link>
          )}
          {role === "ADMIN" && (
            <Link
              href="/admin"
              onClick={onNavigate}
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className={navLinkClass(pathname.startsWith("/admin"), mobile)}
            >
              Admin
            </Link>
          )}
          {wrapMobile(
            <form action={logoutAction}>
              <button type="submit" className={mobile ? clsx(INACTIVE_CLASS, "text-base") : INACTIVE_CLASS}>
                Log out
              </button>
            </form>
          )}
        </>
      ) : (
        // On mobile these live in the header row itself instead (see
        // HeaderNav's own return below) — not repeated here too, since
        // that row is always visible regardless of whether the dropdown
        // panel is open.
        !mobile && (
          <>
            <Link
              href="/login"
              onClick={onNavigate}
              aria-current={pathname === "/login" ? "page" : undefined}
              className={navLinkClass(pathname === "/login", mobile)}
            >
              Log in
            </Link>
            <Link
              href="/register"
              onClick={onNavigate}
              className={clsx(
                "rounded-md px-3 py-1.5 text-white transition",
                pathname === "/register" ? "bg-brand-accent hover:bg-brand-accent/90" : "bg-brand hover:bg-brand/90"
              )}
            >
              Register
            </Link>
          </>
        )
      )}
    </>
  );
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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Belt-and-suspenders with onNavigate on each link: this catches
  // navigations the click handler can't (browser back/forward, or a link
  // inside FindACarDropdown/OurServicesDropdown's own sub-panel, which
  // don't wire onNavigate since they're shared with the desktop nav too).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <>
      {/* `order-first` pulls this ahead of the logo (SiteHeader.tsx renders
          the logo Link before HeaderNav, both siblings in the same flex
          row) purely visually, on mobile only — desktop keeps the logo
          first since this button is hidden there. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="order-first flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-700 transition hover:bg-black/5 md:hidden"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        aria-controls="mobile-nav-panel"
      >
        {mobileOpen ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Mobile-only, signed-out-only: keeps Log in/Register visible on the
          header row itself (right edge, via `ml-auto`) rather than buried
          behind the hamburger — desktop already shows these at the end of
          the full nav below, so this is hidden there to avoid a duplicate. */}
      {!role && (
        <div className="ml-auto flex shrink-0 items-center gap-2 md:hidden">
          <Link
            href="/login"
            aria-current={pathname === "/login" ? "page" : undefined}
            className={clsx(
              "text-sm font-medium transition",
              pathname === "/login" ? ACTIVE_CLASS : INACTIVE_CLASS
            )}
          >
            Log in
          </Link>
          <Link
            href="/register"
            className={clsx(
              "rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition",
              pathname === "/register" ? "bg-brand-accent hover:bg-brand-accent/90" : "bg-brand hover:bg-brand/90"
            )}
          >
            Register
          </Link>
        </div>
      )}

      {/* `md:ml-auto` replaces the parent row's old `justify-between` (see
          SiteHeader.tsx) — it's the thing actually pushing this flush
          right against the logo on desktop, now that the row has to also
          accommodate the mobile hamburger button without justify-between
          shoving it to the far edge. */}
      <nav className="hidden flex-wrap items-center gap-[18px] text-sm font-medium md:ml-auto md:flex">
        <NavLinks mobile={false} role={role} categoryCounts={categoryCounts} totalListingCount={totalListingCount} />
      </nav>

      {mobileOpen && (
        <>
          {/* Dims the page behind the panel and gives a tap target to
              dismiss it — sits under the panel (z-30 vs z-40) and above
              everything else on the page. */}
          <div
            className="fixed inset-0 z-30 bg-black/20 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Positioned off the sticky <header> itself (see SiteHeader.tsx
              — sticky establishes a positioning context the same way
              relative would), not this flex row, so `inset-x-0`/`top-full`
              span the whole header and sit flush beneath it regardless of
              this row's own padding. */}
          <div
            id="mobile-nav-panel"
            className="absolute inset-x-0 top-full z-40 max-h-[calc(100vh-56px)] overflow-y-auto bg-white shadow-lg md:hidden"
          >
            <NavLinks
              mobile
              role={role}
              categoryCounts={categoryCounts}
              totalListingCount={totalListingCount}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}
