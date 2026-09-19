"use client";

import { useLinkStatus } from "next/link";

// Rendered INSIDE a card's <Link> (useLinkStatus only works for a descendant
// of the link it reports on). The moment the card is clicked and until the
// next page has arrived, the card gets a highlight ring straight away (so the
// click is acknowledged instantly and it's clear which listing is being
// opened), followed a beat later by a dimming veil with a spinner — instead
// of the page appearing frozen while the server works. The veil's short delay
// (see .link-pending-veil in globals.css) is so a navigation that finishes
// almost immediately doesn't flash it. Renders nothing the rest of the time,
// so cards cost nothing extra at rest.
export function CardLinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 rounded-xl ring-2 ring-inset ring-brand"
      role="status"
      aria-live="polite"
    >
      <div className="link-pending-veil flex h-full w-full items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
        <span className="sr-only">Opening listing…</span>
        <span
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand/25 border-t-brand"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
