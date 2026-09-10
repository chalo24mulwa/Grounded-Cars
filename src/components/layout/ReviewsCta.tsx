import Link from "next/link";
import { AVERAGE_RATING, TESTIMONIALS } from "@/components/reviews/testimonials-data";
import { StarRating } from "@/components/reviews/StarRating";

// Mounted once in the root layout, between <main> and <SiteFooter> — a
// persistent, site-wide nudge toward /reviews, the same "always present"
// treatment the footer itself already gets rather than something scoped to
// just the public marketing pages.
export function ReviewsCta() {
  return (
    <div className="border-t border-slate-200 bg-brand-mist">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
        <div className="flex items-center gap-3">
          <StarRating rating={Math.round(AVERAGE_RATING)} size={18} />
          <p className="text-sm font-medium text-slate-700">
            Rated {AVERAGE_RATING.toFixed(1)}/5 by {TESTIMONIALS.length}+ Kenyan car buyers and
            sellers
          </p>
        </div>
        <Link
          href="/reviews"
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90"
        >
          Read Customer Reviews
        </Link>
      </div>
    </div>
  );
}
