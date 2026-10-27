import type { VehicleClassification } from "@prisma/client";

// Replaces ImportStatusBadge as the listing's classification tag — same
// brand-green pill, same corner placement and sizing, but renders one badge
// per selected classification (a listing can hold up to all four) instead
// of exactly one. Legacy listings with no classification saved yet
// (`classifications` empty — see schema.prisma) render nothing, same as
// before this field existed, rather than inventing a label.
const LABELS: Record<VehicleClassification, string> = {
  GROUNDED: "Grounded",
  SALVAGE: "Salvage",
  AUCTION: "Auction",
  OLD_SCHOOL: "Old School",
};

export function ClassificationBadges({
  classifications,
  corner = true,
}: {
  classifications: VehicleClassification[];
  corner?: boolean;
}) {
  if (classifications.length === 0) return null;

  if (corner) {
    return (
      <div
        className="absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1 max-sm:bottom-1.5 max-sm:left-1.5 max-sm:gap-0.5"
        aria-label={`Classification: ${classifications.map((c) => LABELS[c]).join(", ")}`}
      >
        {classifications.map((c) => (
          <span
            key={c}
            role="status"
            className="inline-flex items-center rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-brand-deep/40 max-sm:px-1.5 max-sm:text-[8px] max-sm:tracking-normal"
          >
            {LABELS[c]}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`Classification: ${classifications.map((c) => LABELS[c]).join(", ")}`}>
      {classifications.map((c) => (
        <span
          key={c}
          role="status"
          className="inline-flex items-center rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
        >
          {LABELS[c]}
        </span>
      ))}
    </div>
  );
}
