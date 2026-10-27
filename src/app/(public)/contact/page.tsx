import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: { absolute: "Contact Grounded Cars | Buy, Sell & List Vehicles in Kenya" },
  description:
    "Get in touch with Grounded Cars to buy or sell a grounded or salvage vehicle, ask about an auction or old-school car, list your vehicle for free, or get marketplace support.",
  alternates: { canonical: "/contact" },
};

// Each topic routes through the same WhatsApp/phone channel already used
// site-wide (ServicePageLayout, WhatsAppButton, listing detail's seller
// contact) — pre-filled with which topic the visitor is asking about, same
// "no separate backend, no fabricated form" pattern as those.
const TOPICS = [
  {
    title: "Buy a grounded or salvage car",
    description: "Looking to buy a grounded or salvage vehicle directly from Grounded Cars?",
    message: "Hi, I'd like to buy a grounded or salvage car from Grounded Cars.",
  },
  {
    title: "Sell a grounded or salvage car",
    description: "Grounded Cars buys grounded and salvage vehicles directly — tell us about yours.",
    message: "Hi, I have a grounded or salvage car I'd like to sell to Grounded Cars.",
  },
  {
    title: "Auction vehicle enquiries",
    description: "Questions about an auction car listed on the marketplace.",
    message: "Hi, I have a question about an auction vehicle on Grounded Cars.",
  },
  {
    title: "Old-school vehicle enquiries",
    description: "Looking for, or have questions about, an old-school/classic car.",
    message: "Hi, I have a question about an old-school car on Grounded Cars.",
  },
  {
    title: "List your vehicle for free",
    description: "Sell through the marketplace — listing a vehicle is free.",
    message: "Hi, I'd like help listing my vehicle for free on Grounded Cars.",
  },
  {
    title: "General marketplace support",
    description: "Anything else — account help, a listing question, or general support.",
    message: "Hi, I need help with something on Grounded Cars.",
  },
];

export default function ContactPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-brand via-brand-deep to-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ring-1 ring-white/25">
            Contact Us
          </span>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl md:text-5xl">
            Talk to Grounded Cars
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            Whether you want to buy or sell a grounded, salvage, auction, or old-school vehicle, list
            your car for free, or just need help — reach us directly below.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TOPICS.map((topic) => {
            const whatsappHref = `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(topic.message)}`;
            return (
              <div key={topic.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="font-semibold text-slate-900">{topic.title}</p>
                <p className="mt-1 text-sm text-slate-600">{topic.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand/90"
                  >
                    Chat on WhatsApp
                  </a>
                  <a
                    href={`tel:${siteConfig.contactPhone}`}
                    className="rounded-md border border-brand/30 bg-white px-3.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand-subtle"
                  >
                    Call us
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-brand/20 bg-brand/5 p-6 text-center">
          <p className="font-semibold text-slate-900">Prefer to call directly?</p>
          <p className="mt-1 text-lg font-bold text-brand">{siteConfig.contactPhone}</p>
          <p className="mt-4 text-sm text-slate-500">
            You can also{" "}
            <Link href="/cars" className="font-medium text-brand hover:underline">
              browse verified listings
            </Link>{" "}
            or{" "}
            <Link href="/about-us" className="font-medium text-brand hover:underline">
              learn more about Grounded Cars
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
