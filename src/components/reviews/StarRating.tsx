import clsx from "clsx";

// Whole-star display only (no half-stars) — every rating in
// testimonials-data.ts is a plain 1-5 integer, so there's nothing for a
// half-star to render.
export function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`Rated ${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} filled={i < rating} size={size} />
      ))}
    </div>
  );
}

function StarIcon({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={clsx(filled ? "fill-brand-gold" : "fill-slate-200")}
      aria-hidden="true"
    >
      <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9L10 15l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8L10 1.5z" />
    </svg>
  );
}
