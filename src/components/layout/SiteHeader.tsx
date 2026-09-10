import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { HeaderNav } from "@/components/layout/HeaderNav";
import { getCategoryCounts } from "@/server/services/listing-service";

// Session-aware brand shell. An async server component (not "use client")
// so it can read the session directly — no client-side session fetch or
// layout shift while it resolves.
export async function SiteHeader() {
  const [session, categoryCounts] = await Promise.all([auth(), getCategoryCounts()]);
  // Every listing has exactly one category, so summing these is the total —
  // no separate count query needed for "All Vehicles".
  const totalListingCount = categoryCounts.reduce((sum, c) => sum + c.count, 0);

  return (
    // top offset matches UtilityBar's own rendered height (see layout.tsx —
    // it's mounted directly above this) so the two stick stacked, not
    // overlapping, once scrolled.
    <header className="sticky top-[42px] z-40 bg-white shadow-md">
      {/* Thin echo of the logo's own green→gold→orange sweep (see
          tailwind.config.ts) — a quiet brand touch on every page without
          competing with the nav content below it. */}
      <div className="h-[3px] w-full bg-gradient-to-r from-brand via-brand-gold to-brand-accent" />
      {/* No justify-between here — on mobile the only visible items are the
          hamburger button and the logo (the desktop nav is `hidden` and
          drops out of flex layout entirely), so justify-between would push
          them to opposite edges instead of keeping them adjacent. The
          desktop nav pulls itself flush right with its own `md:ml-auto`
          instead (see HeaderNav.tsx). */}
      <div className="mx-auto flex max-w-6xl items-center gap-3 py-2 pl-2 pr-4">
        {/* /brand/logo-header.svg is a cropped copy of the shared
            transparent logo (public/brand/logo.svg — still used as-is by
            the footer) — that source file's own viewBox is a mostly-blank
            1024×1024 square holding both the icon AND a "Car Marketplace"
            wordmark baked into the artwork, so displaying it small hid how
            much dead space surrounded the actual mark. This copy's viewBox
            is cropped to the icon's real paint bounds only (no wordmark),
            so at any given size the icon fills its box instead of floating
            in mostly-empty canvas — see the git history for the bounding-
            box math. The wordmark text below is a separate DOM element
            (not part of the cropped image) so its gradient can be styled
            independently — orange→gold→green left to right, matching the
            reference wordmark's own color sweep. Left padding on this row
            is deliberately tighter than the right (pl-2 vs pr-4) to pull
            the mark toward the header's left edge. */}
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={siteConfig.name}>
          <Image
            src="/brand/logo-header.svg"
            alt={siteConfig.name}
            width={50}
            height={33}
            priority
          />
          <span className="bg-gradient-to-r from-brand-accent via-brand-gold to-brand bg-clip-text text-lg font-bold text-transparent">
            {siteConfig.name}
          </span>
        </Link>

        <HeaderNav
          role={session?.user?.role}
          categoryCounts={categoryCounts}
          totalListingCount={totalListingCount}
        />
      </div>
    </header>
  );
}
