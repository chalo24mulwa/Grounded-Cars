"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

// Split out from UtilityBar.tsx (a server component, for session access)
// purely so this can read the current route via usePathname() — same
// "server shell + client nav for active-state" split used for the header
// (see HeaderNav.tsx) and already established elsewhere (DashboardNav,
// AdminNav).
const LINK_CLASS =
  "whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold transition sm:text-sm";

export function UtilityBarNav({
  featuredHref,
  contactPhone,
  displayPhone,
}: {
  featuredHref: string;
  contactPhone: string;
  displayPhone: string;
}) {
  const pathname = usePathname();

  const links: { label: string; href: string; active: boolean }[] = [
    { label: "Sponsor My Listing", href: featuredHref, active: pathname === "/dashboard/featured" },
    { label: "Top Cars of the Week", href: "/best-deals", active: pathname === "/best-deals" },
    { label: "Upcoming Events", href: "/events", active: pathname.startsWith("/events") },
    { label: "Support Our CSR", href: "/csr", active: pathname.startsWith("/csr") },
  ];

  return (
    <div className="mx-auto flex max-w-6xl items-center justify-end gap-4 px-4 py-1.5 text-xs sm:text-sm">
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          aria-current={link.active ? "page" : undefined}
          className={clsx(
            LINK_CLASS,
            link.active ? "bg-brand-accent text-white" : "text-slate-800 hover:bg-black/5"
          )}
        >
          {link.label}
        </Link>
      ))}
      <a
        href={`tel:${contactPhone}`}
        className="whitespace-nowrap text-slate-600 transition hover:text-slate-900"
      >
        Call: {displayPhone}
      </a>
    </div>
  );
}
