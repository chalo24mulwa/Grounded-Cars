"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin" },
  { label: "Listings", href: "/admin/listings" },
  { label: "Users", href: "/admin/users" },
  { label: "Moderators", href: "/admin/moderators" },
  { label: "Featured Plans", href: "/admin/plans" },
  { label: "Subscriptions", href: "/admin/subscriptions" },
  { label: "Events", href: "/admin/events" },
  { label: "CSR Initiatives", href: "/admin/csr" },
  { label: "Services", href: "/admin/services" },
  { label: "Insurance Policies", href: "/admin/insurance" },
  { label: "Coupons", href: "/admin/coupons" },
  { label: "Audit Log", href: "/admin/audit-log" },
  { label: "SEO Diagnostics", href: "/admin/seo" },
];

// Only listed while the Trending feature is switched on.
const TRENDING_ITEM = { label: "Trending", href: "/admin/trending" };

export function AdminNav({ showTrending = false }: { showTrending?: boolean }) {
  const pathname = usePathname();
  const items = showTrending ? [...NAV_ITEMS.slice(0, -2), TRENDING_ITEM, ...NAV_ITEMS.slice(-2)] : NAV_ITEMS;

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  return (
    <>
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
              isActive(item.href) ? "bg-brand text-white" : "text-slate-600 hover:bg-brand-subtle"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <nav className="hidden w-56 shrink-0 lg:block">
        <ul className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "block rounded-md px-3 py-2 text-sm font-medium",
                  isActive(item.href) ? "bg-brand text-white" : "text-slate-600 hover:bg-brand-subtle"
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
