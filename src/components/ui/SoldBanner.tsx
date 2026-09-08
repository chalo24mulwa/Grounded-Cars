// Premium SOLD flag for the vehicle detail page — an inline badge (not
// absolutely positioned like SoldRibbon) so it sits cleanly in normal page
// flow above the title without covering any vehicle information. Only ever
// rendered by the caller when `listing.status === "SOLD"`.
export function SoldBanner() {
  return (
    <div
      role="status"
      aria-label="This vehicle has been sold"
      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand to-brand-deep px-4 py-1.5 text-sm font-extrabold uppercase tracking-wider text-white shadow-md ring-1 ring-brand-deep/30"
    >
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
          clipRule="evenodd"
        />
      </svg>
      Sold
    </div>
  );
}
