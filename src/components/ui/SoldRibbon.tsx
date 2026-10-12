// Diagonal corner-ribbon treatment for the SOLD status, used on car card
// thumbnails across the public marketplace. Deliberately top-LEFT (leaving
// top-right free for a future favorites heart icon) and deliberately its
// own component rather than a StatusBadge variant — a ribbon needs an
// `absolute inset-0` wrapper clipped by the card's own `overflow-hidden`,
// which is a different contract than StatusBadge's inline pill.
//
// Only ever rendered when the caller has already checked
// `listing.status === "SOLD"` — there is no prop that lets this render for
// any other status, so it can't be used to fake a SOLD flag on an active
// listing.
export function SoldRibbon() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        role="status"
        aria-label="This vehicle has been sold"
        className="absolute -left-12 top-6 w-48 -rotate-45 bg-gradient-to-r from-brand to-brand-deep py-1.5 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] ring-1 ring-white/30 max-sm:-left-14 max-sm:top-4 max-sm:py-1 max-sm:text-[10px]"
      >
        Sold
      </div>
    </div>
  );
}
