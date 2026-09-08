import clsx from "clsx";
import type { ListingStatus } from "@prisma/client";

// General-purpose inline status pill — used in the seller dashboard (My
// Cars list, edit page) where a compact label fits naturally in normal
// document flow. For the public-facing SOLD flag on car cards and the
// detail page, see SoldRibbon.tsx / SoldBanner.tsx instead — those need
// absolute positioning / premium styling this component deliberately
// doesn't take on, to keep this one usable inside table rows and flex
// layouts without fighting its own CSS.
//
// Renders directly from `listing.status` — there is no path in this
// component that accepts free-text like "SOLD" from a seller. If the
// database says ACTIVE, this shows "Active"; if it says SOLD, it shows
// "Sold". Restoring the listing to ACTIVE flips the label on the next
// render, with no extra cleanup step required.

const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Pending Review",
  ACTIVE: "Active",
  SOLD: "Sold",
  ARCHIVED: "Archived",
};

const STATUS_STYLES: Record<ListingStatus, string> = {
  DRAFT: "bg-status-draft/10 text-status-draft border border-status-draft/30",
  PENDING: "bg-status-pending/10 text-status-pending border border-status-pending/30",
  ACTIVE: "bg-status-active/10 text-status-active border border-status-active/30",
  SOLD: "bg-status-sold text-white",
  ARCHIVED: "bg-status-archived/10 text-status-archived border border-status-archived/30",
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
