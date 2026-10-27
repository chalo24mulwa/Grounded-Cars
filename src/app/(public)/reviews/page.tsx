import Link from "next/link";
import type { Metadata } from "next";
import { AVERAGE_RATING, TESTIMONIALS } from "@/components/reviews/testimonials-data";
import { TestimonialCard } from "@/components/reviews/TestimonialCard";
import { StarRating } from "@/components/reviews/StarRating";

export const metadata: Metadata = {
  title: "Customer Reviews",
  description:
    "Read genuine reviews from Kenyan car buyers and sellers who have used Grounded Cars to list, find, buy and sell vehicles across Kenya.",
  alternates: { canonical: "/reviews" },
};

// Deliberately NO structured data (Review / AggregateRating / a second business
// entity) on this page. These testimonials are hand-written page content (see
// testimonials-data.ts), not reviews collected from customers through a
// review system, so presenting them to search engines as genuine review
// markup would misrepresent them — and the site's one Organization/WebSite
// identity lives only on the homepage (lib/structured-data.ts).
// A static content page (no review-submission form — see
// testimonials-data.ts) surfaced site-wide via ReviewsCta, the banner
// mounted just above <SiteFooter> in the root layout.
export default function ReviewsPage() {
  const roundedAverage = Math.round(AVERAGE_RATING);

  return (
    <div>

      {/* Hero — same brand gradient sweep as the About Us page's hero, for
          a consistent look across the site's informational pages. */}
      <section className="bg-gradient-to-br from-brand via-brand-deep to-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ring-1 ring-white/25">
            Customer Reviews
          </span>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl md:text-5xl">
            Trusted by Buyers and Sellers Across Kenya
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            Real experiences from Grounded Cars customers who have bought, sold, and financed
            vehicles through our platform.
          </p>

          <div className="mx-auto mt-8 inline-flex flex-col items-center gap-2 rounded-xl bg-white/10 px-6 py-4 ring-1 ring-white/20">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl font-bold text-white">{AVERAGE_RATING.toFixed(1)}</span>
              <StarRating rating={roundedAverage} size={22} />
            </div>
            <p className="text-sm text-white/70">
              Based on {TESTIMONIALS.length}+ verified customer experiences
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>

        {/* Closing CTA — same pattern as About Us's own closing section. */}
        <section className="mt-16 rounded-2xl border border-brand/15 bg-brand-mist p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Ready to Join Them?</h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-slate-600">
            Whether you&apos;re looking for your next car or ready to sell the one you have, Car
            Marketplace makes it simple.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/cars"
              className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand/90"
            >
              Browse Vehicles
            </Link>
            <Link
              href="/dashboard/listings/new"
              className="rounded-md border border-brand/30 bg-white px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand-subtle"
            >
              List Your Car
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
