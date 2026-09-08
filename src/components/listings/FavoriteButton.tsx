"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { addFavoriteAction, removeFavoriteAction } from "@/server/actions/favorite-actions";

/**
 * Heart toggle. Used both bare on the detail page and nested inside
 * CarCard's full-card <Link> on listing grids — in the nested case, a click
 * must never also trigger the card's own navigation, hence
 * preventDefault/stopPropagation before anything else runs.
 *
 * Optimistic: flips the icon immediately, then reconciles with the server
 * result. addFavorite()/removeFavorite() are both idempotent server-side
 * (upsert / deleteMany), so a double-click or a slow network never produces
 * an inconsistent state worse than "briefly shows the wrong icon."
 */
export function FavoriteButton({
  listingId,
  initialFavorited,
  isAuthenticated,
}: {
  listingId: string;
  initialFavorited: boolean;
  isAuthenticated: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const next = !favorited;
    setFavorited(next); // optimistic
    startTransition(async () => {
      const result = next ? await addFavoriteAction(listingId) : await removeFavoriteAction(listingId);
      if (!result.success) {
        setFavorited(!next); // revert on failure
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition disabled:opacity-60",
        favorited
          ? "bg-red-500 text-white hover:bg-red-600"
          : "bg-white/90 text-slate-500 hover:bg-white hover:text-red-500"
      )}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill={favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path d="M12 21s-6.7-4.35-9.33-8.2C.6 9.9 1.4 6.2 4.6 4.9c2.1-.85 4.3-.1 5.6 1.6l1.8 2.3 1.8-2.3c1.3-1.7 3.5-2.45 5.6-1.6 3.2 1.3 4 5 2.9 7.9C18.7 16.65 12 21 12 21z" />
      </svg>
    </button>
  );
}
