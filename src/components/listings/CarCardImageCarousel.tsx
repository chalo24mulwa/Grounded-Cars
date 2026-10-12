"use client";

import { useRef, useState } from "react";
import { UploadedImage } from "@/components/ui/UploadedImage";
import clsx from "clsx";

type CardImage = { imageUrl: string; altText: string | null };

const SWIPE_THRESHOLD_PX = 30;

// The image area of a CarCard — playable in place (arrows on hover, dots,
// swipe) without leaving the grid, same sliding-track technique as the
// detail page's CarImageGallery. Isolated from CarCard itself so the rest
// of the card (and the pages that render dozens of them) stays a plain,
// non-hydrated Server Component — only this small image area ships client
// JS. Badges/FavoriteButton are passed in as `children` and rendered
// exactly where CarCard already positioned them; this component never
// touches their markup, only the image beneath them.
//
// CarCard wraps everything in a single <Link> (the whole card navigates to
// the listing), so every control in here that shouldn't trigger that
// navigation — arrows, dots, an actual swipe — calls preventDefault() (and
// stopPropagation() for the click handlers). A plain tap/click with no drag
// deliberately does NOT preventDefault, so tapping the photo still opens
// the listing like before.
export function CarCardImageCarousel({
  images,
  title,
  isSold,
  priority = false,
  children,
}: {
  images: CardImage[];
  title: string;
  isSold: boolean;
  /** Load the first photo immediately (cards in the first visible row). */
  priority?: boolean;
  children?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  // Only the first photo is downloaded with the page. The others are
  // fetched once the visitor actually starts flipping through this card —
  // a grid of 24 cards used to download every card's full photo set up
  // front, almost none of which anyone ever looks at.
  const [hasInteracted, setHasInteracted] = useState(false);
  // A CarImage row existing in the database is no guarantee the file it
  // points at still exists on disk (e.g. an upload from before the
  // persistent-storage fix, since deleted along with an old deploy) — an
  // <img> whose src 404s renders the browser's own broken-image icon by
  // default, which is exactly the "blank box" bug this fixes. Once an
  // image actually fails to load, it's dropped from what this carousel
  // considers real, falling back to the existing "No photo available"
  // state below if that empties the list entirely, or just seamlessly
  // skipping it if other photos on the same listing still load fine.
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(() => new Set());
  const visibleImages = images.filter((img) => !failedUrls.has(img.imageUrl));
  const count = visibleImages.length;
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  function step(delta: number) {
    setHasInteracted(true);
    setIndex((i) => ((i + delta) % count + count) % count);
  }

  function handleArrowClick(delta: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    step(delta);
  }

  function handleDotClick(i: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setHasInteracted(true);
    setIndex(i);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchDeltaX.current = 0;
    setHasInteracted(true);
  }
  function handleTouchMove(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (touchStartX.current == null || !touch) return;
    touchDeltaX.current = touch.clientX - touchStartX.current;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (Math.abs(touchDeltaX.current) > SWIPE_THRESHOLD_PX) {
      // A real swipe — stop the browser's follow-up synthetic click from
      // also firing (which would otherwise navigate to the listing right
      // after the user just swiped to look at another photo).
      e.preventDefault();
      step(touchDeltaX.current < 0 ? 1 : -1);
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  }

  if (count === 0) {
    return (
      <div className="relative aspect-[4/3] w-full bg-slate-100">
        <div className="flex h-full items-center justify-center text-slate-400">
          No photo available
        </div>
        {children}
      </div>
    );
  }

  // Clamps against the post-filter count, not the raw prop length — an
  // onError firing for whatever slide is currently showing (or one ahead
  // of it) would otherwise leave the track translated past the end of the
  // now-shorter list, i.e. scrolled to blank space.
  const safeIndex = Math.min(index, count - 1);

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100"
      onTouchStart={count > 1 ? handleTouchStart : undefined}
      onTouchMove={count > 1 ? handleTouchMove : undefined}
      onTouchEnd={count > 1 ? handleTouchEnd : undefined}
    >
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${safeIndex * 100}%)` }}
      >
        {visibleImages.map((img, i) => (
          <div key={img.imageUrl} className="relative h-full w-full shrink-0">
            {/* Slides more than one step away from the visible one stay empty
                until needed; neighbours are mounted once the visitor
                interacts, so the next swipe already has its photo. */}
            {(i === safeIndex ||
              (hasInteracted && (Math.abs(i - safeIndex) <= 1 || Math.abs(i - safeIndex) === count - 1))) && (
              <UploadedImage
                src={img.imageUrl}
                alt={img.altText ?? `${title} — photo ${i + 1}`}
                fill
                priority={priority && i === 0}
                className={clsx("object-cover", isSold && "grayscale-[15%]")}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                onError={() => setFailedUrls((prev) => new Set(prev).add(img.imageUrl))}
              />
            )}
          </div>
        ))}
      </div>

      {children}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => handleArrowClick(-1, e)}
            aria-label="Previous photo"
            className="absolute left-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/60"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={(e) => handleArrowClick(1, e)}
            aria-label="Next photo"
            className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/60"
          >
            <ChevronIcon direction="right" />
          </button>

          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1">
            {visibleImages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => handleDotClick(i, e)}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === safeIndex}
                className={clsx(
                  "h-1.5 w-1.5 rounded-full shadow-sm transition",
                  i === safeIndex ? "bg-white" : "bg-white/60 hover:bg-white/90"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
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
