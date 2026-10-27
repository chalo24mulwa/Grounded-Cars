"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BecomeSellerButton } from "@/components/auth/BecomeSellerButton";

// Split out from UtilityBar.tsx (a server component, for session access)
// purely so this can read the current route via usePathname() — same
// "server shell + client nav for active-state" split used for the header
// (see HeaderNav.tsx) and already established elsewhere (DashboardNav,
// AdminNav).
//
// Font size/padding is deliberately smaller below `sm` than the original
// fixed text-xs/px-3 — the four labels plus phone number plus (mobile-only)
// "List Car" button don't all fit at the desktop size on a narrow phone
// screen. `overflow-x-auto` on the row is a safety net on top of that
// shrink, not the primary fix: it keeps things from ever visibly wrapping
// or spilling out of the bar even on the very narrowest devices.
const LINK_CLASS =
  "whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition sm:px-3 sm:text-sm";

export function UtilityBarNav({
  contactPhone,
  displayPhone,
  listCarHref,
}: {
  contactPhone: string;
  displayPhone: string;
  // Mobile-only "List Car" shortcut (desktop already has "Sell a Car" in
  // the header nav) — set for staff (straight to the listing form) and
  // signed-out visitors (login first). Undefined means a signed-in buyer,
  // rendered as BecomeSellerButton below since upgrading is a real mutation,
  // not a plain navigation.
  listCarHref?: string;
}) {
  const pathname = usePathname();
  const isBuyer = listCarHref === undefined;

  // `mobileLabel`: a shorter name shown on phones only (below `sm`), to free up
  // room in this bar. The full label is used everywhere else — tablet and
  // desktop, page titles, the footer and every other link to these pages.
  const links: { label: string; mobileLabel?: string; href: string; active: boolean }[] = [
    { label: "Grounded", href: "/cars/grounded", active: pathname === "/cars/grounded" },
    { label: "Salvage", href: "/cars/salvage", active: pathname === "/cars/salvage" },
    { label: "Auction", href: "/cars/auction", active: pathname === "/cars/auction" },
    { label: "Upcoming Events", mobileLabel: "Car Events", href: "/events", active: pathname.startsWith("/events") },
    { label: "Support Our CSR", mobileLabel: "CSR Donors", href: "/csr", active: pathname.startsWith("/csr") },
  ];

  return (
    <div className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-3 py-1.5 text-[11px] sm:gap-4 sm:px-4 sm:text-sm">
      {links.map((link, index) => (
        <Link
          key={link.label}
          href={link.href}
          aria-current={link.active ? "page" : undefined}
          className={clsx(
            LINK_CLASS,
            // Replaces the container's old `justify-end` — that pushes
            // right-aligned when the row fits, but pushed the overflow off
            // the unreachable *start* side on a narrow phone (scrollLeft
            // can't go negative), stranding whichever link happened to be
            // first in the array. `ml-auto` on just the first link gives
            // the same right-aligned look whenever everything fits, while
            // letting the row scroll from a real left edge when it doesn't.
            index === 0 && "ml-auto",
            link.active ? "bg-brand-accent text-white" : "text-slate-800 hover:bg-black/5"
          )}
        >
          {link.mobileLabel ? (
            <>
              <span className="sm:hidden">{link.mobileLabel}</span>
              <span className="max-sm:hidden">{link.label}</span>
            </>
          ) : (
            link.label
          )}
        </Link>
      ))}
      <a
        href={`tel:${contactPhone}`}
        className="whitespace-nowrap text-slate-600 transition hover:text-slate-900"
      >
        Call: {displayPhone}
      </a>
      {/* Mobile-only: on desktop "Sell a Car" is already one tap away in the
          always-visible header nav, so this would just be a duplicate CTA. */}
      {isBuyer ? (
        <BecomeSellerButton
          redirectTo="/dashboard/listings/new"
          label="List Car"
          pendingLabel="Setting up…"
          className={clsx(LINK_CLASS, "bg-brand text-white hover:bg-brand/90 md:hidden")}
        />
      ) : (
        <Link href={listCarHref} className={clsx(LINK_CLASS, "bg-brand text-white hover:bg-brand/90 md:hidden")}>
          List Car
        </Link>
      )}
    </div>
  );
}
