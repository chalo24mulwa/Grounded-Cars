"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const SERVICE_LINKS = [
  { label: "Pre-Purchase Inspection", href: "/services/pre-purchase-inspection" },
  { label: "Car Financing", href: "/services/car-financing" },
  { label: "Car Valuation", href: "/services/car-valuation" },
  { label: "Car Tracking", href: "/services/car-tracking" },
  { label: "Home Repairs", href: "/services/home-repairs" },
  { label: "Car Insurance Cover", href: "/services/car-insurance" },
];

// Hover-triggered dropdown: opens the moment the cursor is over the
// trigger (no click needed), closes the moment it leaves — via CSS
// (`group`/`group-hover`), not JS. Also opens on keyboard focus
// (`group-focus-within`) so it stays usable by keyboard — hover-only menus
// are otherwise a real accessibility gap. Now a client component (it was
// pure CSS before) only so the trigger and the matching sub-link can show
// an active state via usePathname() — same pattern as HeaderNav.
//
// The panel's own `pt-2` (not a margin on its wrapper) is what makes the
// hover survive moving the cursor from the trigger down into the menu: the
// padding is still inside the hoverable box, so there's no gap of dead
// space between "Our Services" and the menu where a `mt-*` would otherwise
// let the cursor fall out of `:hover` and the menu would flicker shut
// before you reach it.
export function OurServicesDropdown() {
  const pathname = usePathname();
  const triggerActive = pathname.startsWith("/services");

  return (
    <div className="group relative">
      <button
        type="button"
        className={clsx(
          "flex items-center gap-1 transition focus:outline-none",
          triggerActive
            ? "text-brand-accent font-semibold"
            : "text-slate-600 hover:text-brand focus:text-brand"
        )}
        aria-haspopup="true"
        aria-current={triggerActive ? "page" : undefined}
      >
        Our Services
        <svg
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="transition group-hover:rotate-180 group-focus-within:rotate-180"
          aria-hidden="true"
        >
          <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="invisible absolute left-0 top-full z-20 pt-2 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="w-52 rounded-lg bg-white py-2 shadow-md ring-1 ring-black/5">
          {SERVICE_LINKS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "block px-4 py-1.5 text-sm transition",
                  active ? "bg-brand-accent/10 text-brand-accent font-semibold" : "text-slate-700 hover:bg-brand/5 hover:text-brand"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
