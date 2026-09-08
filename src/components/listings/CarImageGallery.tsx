"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

type GalleryImage = { id?: string; imageUrl: string; altText: string | null };

const SWIPE_THRESHOLD_PX = 40;

// The car detail page's hero — a real sliding carousel (not just a static
// image swap), a synced thumbnail strip, and a full-screen lightbox, all
// driven off one `index` so every surface (main image, thumbnails, counter,
// lightbox) always agrees on what's showing. Deliberately one component
// rather than splitting carousel/lightbox apart — they share all of index
// state, keyboard handling, and the image list, and splitting them would
// just mean prop-drilling the same five things across a boundary that buys
// nothing.
export function CarImageGallery({
  images,
  title,
  isSold = false,
  overlay,
}: {
  images: GalleryImage[];
  title: string;
  isSold?: boolean;
  /** Rendered as an absolutely-positioned overlay on the main image (e.g.
   * the Import Status badge) — kept generic so this component doesn't need
   * to know about listing-specific badges. */
  overlay?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  const count = images.length;

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count); // wraps both directions
    },
    [count]
  );
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  // Keyboard nav: arrows always move the carousel when it (or the lightbox)
  // has focus/is open; Escape only makes sense once the lightbox is open.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape" && lightboxOpen) setLightboxOpen(false);
    }
    if (!lightboxOpen) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, goPrev, goNext]);

  // Lightbox is a full-viewport overlay — the page behind it shouldn't
  // scroll while it's open, same as any modal.
  useEffect(() => {
    if (!lightboxOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [lightboxOpen]);

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchDeltaX.current = 0;
  }
  function handleTouchMove(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (touchStartX.current == null || !touch) return;
    touchDeltaX.current = touch.clientX - touchStartX.current;
  }
  function handleTouchEnd() {
    if (Math.abs(touchDeltaX.current) > SWIPE_THRESHOLD_PX) {
      if (touchDeltaX.current < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  }

  if (count === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <div className="flex aspect-[16/10] w-full items-center justify-center text-slate-400">
          No photos available
        </div>
        {overlay}
      </div>
    );
  }

  // count > 0 here (the count === 0 branch above already returned), and
  // goTo()'s modulo wrap keeps `index` in [0, count) at all times — this is
  // just proving that to TypeScript, not a real fallback path.
  const currentImage = images[index] ?? images[0]!;

  return (
    <div>
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={`${title} photos`}
        tabIndex={0}
        className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative aspect-[16/10] w-full">
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {images.map((img, i) => (
              <button
                key={img.id ?? img.imageUrl}
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label={`View photo ${i + 1} of ${count} full-screen`}
                className="relative h-full w-full shrink-0 cursor-zoom-in"
              >
                <Image
                  src={img.imageUrl}
                  alt={img.altText ?? `${title} — photo ${i + 1}`}
                  fill
                  className={isSold ? "object-cover grayscale-[15%]" : "object-cover"}
                  sizes="(max-width: 768px) 100vw, 800px"
                  priority={i === 0}
                />
              </button>
            ))}
          </div>
        </div>

        {overlay}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
            >
              <ChevronIcon direction="right" />
            </button>
            <span className="absolute bottom-3 right-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id ?? img.imageUrl}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1} of ${count}`}
              aria-current={i === index}
              className={
                "relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border-2 transition " +
                (i === index ? "border-brand" : "border-transparent hover:border-slate-300")
              }
            >
              <Image
                src={img.imageUrl}
                alt={img.altText ?? `${title} — thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="112px"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — full-screen photo viewer`}
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
          onClick={() => setLightboxOpen(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close full-screen photo viewer"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <CloseIcon />
          </button>

          <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 flex items-center justify-center p-4 pb-2 sm:p-10">
              <div className="relative h-full w-full">
                <Image
                  src={currentImage.imageUrl}
                  alt={currentImage.altText ?? `${title} — photo ${index + 1}`}
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              </div>
            </div>

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
                >
                  <ChevronIcon direction="left" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
                >
                  <ChevronIcon direction="right" />
                </button>
              </>
            )}
          </div>

          {count > 1 && (
            <div
              className="flex shrink-0 items-center justify-center gap-2 overflow-x-auto px-4 pb-6 pt-2"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="mr-2 shrink-0 text-xs font-medium text-white/70">
                {index + 1} / {count}
              </span>
              {images.map((img, i) => (
                <button
                  key={img.id ?? img.imageUrl}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Show photo ${i + 1} of ${count}`}
                  aria-current={i === index}
                  className={
                    "relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition " +
                    (i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100")
                  }
                >
                  <Image
                    src={img.imageUrl}
                    alt={img.altText ?? `${title} — thumbnail ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      aria-hidden="true"
    >
      <path
        d={direction === "left" ? "M12.5 5l-5 5 5 5" : "M7.5 5l5 5-5 5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}
