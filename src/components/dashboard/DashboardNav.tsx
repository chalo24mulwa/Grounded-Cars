"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import type { UserRole } from "@prisma/client";

type NavItem = { label: string; href: string; status?: string };

const BASE_NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "My Cars", href: "/dashboard/listings" },
  { label: "Add New Car", href: "/dashboard/listings/new" },
  { label: "Active", href: "/dashboard/listings?status=ACTIVE", status: "ACTIVE" },
  { label: "Pending Review", href: "/dashboard/listings?status=PENDING", status: "PENDING" },
  { label: "Sold Cars", href: "/dashboard/listings?status=SOLD", status: "SOLD" },
  { label: "Drafts", href: "/dashboard/listings?status=DRAFT", status: "DRAFT" },
  { label: "Archived", href: "/dashboard/listings?status=ARCHIVED", status: "ARCHIVED" },
  { label: "Featured Listings", href: "/dashboard/featured" },
  { label: "Inquiries", href: "/dashboard/inquiries" },
];

// Only a MODERATOR sees these — two narrow admin-delegated powers layered
// on top of full seller access (see requireListingModerationAccess /
// getSellersForModerator). Nothing else in the (admin) area is reachable
// from this role, so no other items are added here.
const MODERATOR_NAV_ITEMS: NavItem[] = [
  { label: "Sellers", href: "/dashboard/sellers" },
  { label: "Review Listings", href: "/dashboard/review-listings" },
];

// Same item list drives both layouts — a horizontal scroll strip on mobile,
// a sidebar on desktop — so there is exactly one place that can drift out
// of sync with the actual routes.
export function DashboardNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status");
  const NAV_ITEMS = role === "MODERATOR" ? [...BASE_NAV_ITEMS, ...MODERATOR_NAV_ITEMS] : BASE_NAV_ITEMS;

  function isActive(item: NavItem): boolean {
    if (item.href.split("?")[0] !== pathname) return false;
    if (item.status) return currentStatus === item.status;
    return !currentStatus;
  }

  return (
    <>
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
              isActive(item) ? "bg-brand text-white" : "text-slate-600 hover:bg-brand-subtle"
            )}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/account"
          className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-brand-subtle"
        >
          Profile
        </Link>
      </nav>

      <nav className="hidden w-56 shrink-0 md:block">
        <ul className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "block rounded-md px-3 py-2 text-sm font-medium",
                  isActive(item) ? "bg-brand text-white" : "text-slate-600 hover:bg-brand-subtle"
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="mt-2 border-t border-slate-100 pt-2">
            <Link
              href="/account"
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-subtle"
            >
              Profile &amp; Account
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
