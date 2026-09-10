"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Pixels of scroll from the top before hide/show-on-direction kicks in.
// Below this, the bar always shows — this is roughly where it's still in
// normal document flow or has only just started sticking (see page.tsx's
// `top-[94px]`), so hiding it here would read as a flicker rather than the
// "tucks away while scrolling through listings" behavior this is for.
const REVEAL_ZONE_PX = 140;
// Minimum scroll delta before flipping hidden/visible — filters out the
// sub-pixel jitter some trackpads/mobile browsers report as a reversal on
// every frame, which would otherwise flicker the bar in and out.
const DIRECTION_THRESHOLD_PX = 4;

// Wraps the homepage hero search bar with "hide on scroll down, show on
// scroll up" behavior, same pattern as most native app search bars. Stays
// a plain CSS transform (not display/visibility) so the sticky element
// never leaves the layout flow — nothing below it reflows when it hides or
// reappears, so there's no layout jump either way.
export function StickySearchBar({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;

        if (currentY < REVEAL_ZONE_PX) {
          setHidden(false);
        } else if (delta > DIRECTION_THRESHOLD_PX) {
          setHidden(true);
        } else if (delta < -DIRECTION_THRESHOLD_PX) {
          setHidden(false);
        }

        lastScrollY.current = currentY;
        ticking.current = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`sticky top-[94px] z-30 w-full border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm transition-transform duration-300 ease-in-out will-change-transform ${
        hidden ? "-translate-y-[150%]" : "translate-y-0"
      }`}
    >
      {children}
    </div>
  );
}
