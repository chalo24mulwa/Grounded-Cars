"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Icon } from "@/components/trending/ui";

/** Trending's own tab bar, under the site header. */
export function TrendingNav({ username }: { username: string | null }) {
  const pathname = usePathname();
  const tabs = [
    { label: "For You", href: "/trending", active: pathname === "/trending" || pathname.startsWith("/trending/v/") },
    { label: "Inbox", href: "/trending/messages", active: pathname.startsWith("/trending/messages") },
    {
      label: "Profile",
      href: username ? `/trending/u/${username}` : `/login?callbackUrl=${encodeURIComponent("/trending/settings")}`,
      active: pathname.startsWith("/trending/u/") || pathname.startsWith("/trending/settings"),
    },
  ];
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-3 py-1.5">
        <span className="mr-1 hidden whitespace-nowrap text-base min-[400px]:inline font-extrabold tracking-tight text-slate-900 sm:mr-2">
          Trending<span className="text-brand-accent">.</span>
        </span>
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={clsx(
              "whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-semibold transition sm:px-3",
              tab.active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {tab.label}
          </Link>
        ))}
        <Link
          href="/trending/upload"
          className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-brand-accent px-3 py-1 text-sm font-semibold text-white hover:bg-brand-accent/90"
        >
          <Icon name="plus" size={16} /> Upload
        </Link>
      </div>
    </nav>
  );
}
