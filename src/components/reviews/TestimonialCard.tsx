import { StarRating } from "@/components/reviews/StarRating";
import type { Testimonial } from "@/components/reviews/testimonials-data";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <StarRating rating={testimonial.rating} />
      <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand via-brand-gold to-brand-accent text-sm font-semibold text-white"
        >
          {initials(testimonial.name)}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{testimonial.name}</p>
          {testimonial.location && (
            <p className="text-xs text-slate-500">{testimonial.location}</p>
          )}
        </div>
      </figcaption>
    </figure>
  );
}
