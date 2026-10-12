// Premium indicator for featured listings — deliberately gold/amber (not
// green, which SOLD already owns) so the two badges never read as the same
// signal, and positioned opposite SoldRibbon's top-left corner so they
// never collide on a card that happens to have both an image and would
// otherwise never actually occur together anyway (a featured listing is by
// definition ACTIVE — see getFeaturedListingIds()/getPublicListings()).
// The gold→accent gradient is the same two tones the logo mark itself
// transitions through (see tailwind.config.ts) — not an arbitrary color
// choice.
//
// Only ever rendered when the caller has already computed
// `listing.isFeatured` live from the FeaturedSubscription table — never
// from a stored boolean a seller/admin could hand-edit.
export function FeaturedBadge({ corner = true }: { corner?: boolean }) {
  if (corner) {
    return (
      <span
        role="status"
        aria-label="Verified featured listing"
        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-gold to-brand-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-brand-accent/30 max-sm:right-1.5 max-sm:top-1.5 max-sm:gap-0.5 max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[9px]"
      >
        <StarIcon />
        Verified
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label="Verified featured listing"
      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-gold to-brand-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm"
    >
      <StarIcon />
      Verified
    </span>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M10 1.5l2.47 5.51 6.03.6-4.55 4.03 1.32 5.94L10 14.77l-5.27 2.81 1.32-5.94L1.5 7.61l6.03-.6L10 1.5z" />
    </svg>
  );
}
