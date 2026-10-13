import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { ShareButton } from "@/components/share/ShareButton";

// Shared presentational shell for every /services/* page — one place
// decides the layout (hero, benefit list, contact CTA), each page just
// supplies its own copy. These are informational/lead-generation pages,
// not standalone transactional systems (no financing application flow, no
// live GPS map, etc. is built here) — the CTA routes every inquiry through
// the same WhatsApp/phone contact channel already used site-wide
// (WhatsAppButton, listing detail's seller contact), pre-filled with which
// service the visitor is asking about so a real conversation can start
// immediately.
export function ServicePageLayout({
  eyebrow,
  title,
  intro,
  benefits,
  serviceName,
  heroImage,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  benefits: string[];
  /** Used only to pre-fill the WhatsApp message — never sent anywhere on
   * its own, no backend call. */
  serviceName: string;
  /** Optional — most service pages don't have a dedicated banner yet, so
   * this stays opt-in per page rather than required. Without width/height,
   * renders inside the fixed landscape crop box below (fine for an
   * ordinary photo). With width/height supplied, renders at that native
   * aspect ratio instead — for a designed poster/banner image whose own
   * baked-in text runs edge to edge (e.g. pre-purchase-inspection's),
   * where a landscape crop would cut content off. `align: "left"` (only
   * meaningful alongside width/height) additionally shrinks it to a
   * left-hugging block instead of stretching it across the full column —
   * for a page that wants the banner sized down and docked left rather
   * than spanning edge to edge (e.g. home-repairs). */
  heroImage?: { src: string; alt: string; width?: number; height?: number; align?: "left" };
  /** Rendered after all of the above, at the very end of the page — purely
   * additive, never displacing or restyling any existing section. Used by
   * the five service pages to show an order/pay panel (ServiceOrderPanel)
   * when an admin has published a Service for that page; omitted entirely
   * otherwise, so a page with no Service renders exactly as before. */
  children?: React.ReactNode;
}) {
  const whatsappHref = `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(
    `Hi, I'd like to know more about ${serviceName} on ${siteConfig.name}.`
  )}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {heroImage && heroImage.width && heroImage.height ? (
        <div
          className={
            heroImage.align === "left"
              ? "mb-8 mr-auto w-full max-w-md overflow-hidden rounded-xl border border-slate-200"
              : "mb-8 w-full overflow-hidden rounded-xl border border-slate-200"
          }
        >
          <Image
            src={heroImage.src}
            alt={heroImage.alt}
            width={heroImage.width}
            height={heroImage.height}
            className="h-auto w-full"
            sizes={heroImage.align === "left" ? "(max-width: 768px) 100vw, 448px" : "(max-width: 768px) 100vw, 768px"}
            priority
          />
        </div>
      ) : (
        heroImage && (
          <div className="relative mb-8 aspect-[1024/572] w-full overflow-hidden rounded-xl border border-slate-200">
            <Image
              src={heroImage.src}
              alt={heroImage.alt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        )
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          {eyebrow}
        </span>
        {/* No path: shares the service page the visitor is on. */}
        <ShareButton variant="pill" target={{ title: `${serviceName} | ${siteConfig.name}`, imageUrl: heroImage?.src }} />
      </div>
      <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-600">{intro}</p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          What&apos;s included
        </h2>
        <ul className="mt-4 space-y-3">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5 text-sm text-slate-700">
              <CheckIcon />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-brand/20 bg-brand/5 p-6">
        <div className="flex-1">
          <p className="font-semibold text-slate-900">Interested in this service?</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Chat with our team and we&apos;ll walk you through the next steps.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
          >
            Chat on WhatsApp
          </a>
          <a
            href={`tel:${siteConfig.contactPhone}`}
            className="rounded-md border border-brand/30 bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-white/60"
          >
            Call {siteConfig.contactPhone}
          </a>
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Also looking for a car?{" "}
        <Link href="/cars" className="font-medium text-brand hover:underline">
          Browse verified listings
        </Link>
        .
      </p>

      {children}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="mt-0.5 shrink-0 text-brand"
      aria-hidden="true"
    >
      <path d="M4 10.5l3.5 3.5L16 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
