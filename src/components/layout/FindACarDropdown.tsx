"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";

export type CategoryCount = { value: string; label: string; count: number };

// Same hover/focus CSS dropdown as OurServicesDropdown.tsx (see that file's
// comment for why it's hover-triggered and how the `pt-2` gap trick works)
// — this one filters instead of navigating to a fixed page: each item is a
// real link to /cars (optionally `?category=...`), so counts and results
// are always a normal server-rendered page, never client-side filtering.
// Counts are fetched server-side (getCategoryCounts() in
// listing-service.ts) and passed in as a prop — this component itself
// never touches the database.
export function FindACarDropdown({
  categories,
  totalCount,
}: {
  categories: CategoryCount[];
  totalCount: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onCarsPage = pathname.startsWith("/cars");
  const currentCategory = onCarsPage ? searchParams.get("category") : null;

  const items: { label: string; href: string; count: number; value: string | null }[] = [
    { label: "All Vehicles", href: "/cars", count: totalCount, value: null },
    ...categories.map((c) => ({
      label: c.label,
      href: `/cars?category=${c.value}`,
      count: c.count,
      value: c.value,
    })),
  ];

  return (
    <div className="group relative">
      <button
        type="button"
        className={clsx(
          "flex items-center gap-1 transition focus:outline-none",
          onCarsPage ? "text-brand-accent font-semibold" : "text-slate-600 hover:text-brand focus:text-brand"
        )}
        aria-haspopup="true"
        aria-current={onCarsPage ? "page" : undefined}
      >
        Find a Car
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
        <div className="w-64 rounded-lg bg-white py-2 shadow-md ring-1 ring-black/5">
          {items.map((item) => {
            const active = onCarsPage && currentCategory === item.value;
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center justify-between gap-3 px-4 py-1.5 text-sm transition",
                  active
                    ? "bg-brand-accent/10 text-brand-accent font-semibold"
                    : "text-slate-700 hover:bg-brand/5 hover:text-brand"
                )}
              >
                <span>{item.label}</span>
                <span className={clsx("text-xs", active ? "text-brand-accent/80" : "text-slate-400")}>
                  {item.count.toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
