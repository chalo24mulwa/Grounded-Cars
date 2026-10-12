import type { ImportStatus } from "@prisma/client";

// The seller's mandatory Locally Used / Fresh Import declaration (see
// createListingSchema's `importStatus` — required on every listing, never
// blank). Green (the site's brand green, not a random Tailwind shade) —
// distinguished from SoldRibbon by shape/position (a diagonal top-left
// ribbon vs. this small bottom-left pill) and from FeaturedBadge's
// gold→terracotta gradient, so the three never read as the same signal
// despite sharing a hue with Sold. Deliberately small — a quiet corner
// label, not a headline claim.
const LABELS: Record<ImportStatus, string> = {
  LOCALLY_USED: "Locally Used",
  FRESH_IMPORT: "Fresh Import",
};

export function ImportStatusBadge({
  status,
  corner = true,
}: {
  status: ImportStatus;
  corner?: boolean;
}) {
  if (corner) {
    return (
      <span
        role="status"
        aria-label={`Import status: ${LABELS[status]}`}
        className="absolute bottom-2 left-2 z-10 inline-flex items-center rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-brand-deep/40 max-sm:bottom-1.5 max-sm:left-1.5 max-sm:px-1.5 max-sm:text-[8px] max-sm:tracking-normal"
      >
        {LABELS[status]}
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label={`Import status: ${LABELS[status]}`}
      className="inline-flex items-center rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
    >
      {LABELS[status]}
    </span>
  );
}
