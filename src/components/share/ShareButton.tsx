"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";

// The sheet (platform list, Instagram handling) is only downloaded the first
// time someone taps Share, so listing grids don't pay for it up front.
const ShareSheet = dynamic(() => import("@/components/share/ShareSheet").then((m) => m.ShareSheet), { ssr: false });

export type ShareTarget = {
  /** Site path of the page being shared, e.g. "/cars/2013-subaru-forester-0".
   * Omit to share the page the visitor is on. */
  path?: string;
  /** Headline used in the message, e.g. the car title. */
  title: string;
  /** Extra line after the title, e.g. "KES 2,050,000". */
  subtitle?: string;
  /** A photo of the item (site-relative), offered to apps like Instagram
   * that share pictures rather than links. */
  imageUrl?: string;
};

/**
 * Share icon. Safe to place inside a card that is itself a link: the click
 * never also opens the card.
 */
export function ShareButton({
  target,
  variant = "icon",
  className,
}: {
  target: ShareTarget;
  /** "icon": round icon (cards). "pill": icon + "Share" label (detail pages). */
  variant?: "icon" | "pill";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Share ${target.title}`}
        aria-haspopup="dialog"
        className={clsx(
          variant === "pill"
            ? "inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand hover:text-brand"
            : "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-brand hover:text-brand",
          className
        )}
      >
        <ShareIcon size={variant === "pill" ? 16 : 15} />
        {variant === "pill" && <span>Share</span>}
      </button>
      {open && <ShareSheet target={target} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}
