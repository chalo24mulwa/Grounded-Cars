import Link from "next/link";
import { getPublishedInsurancePolicies } from "@/server/services/insurance-service";
import { InsurancePolicyCard } from "@/components/insurance/InsurancePolicyCard";
import { siteConfig } from "@/config/site";

export const metadata = {
  title: "Car Insurance in Kenya",
  description:
    "Grounded Cars has partnered with reliable insurance companies to help you get Third-Party, Commercial, and Comprehensive motor insurance — plans from as low as KES 1,000.",
  alternates: { canonical: "/services/car-insurance" },
};

const BENEFITS = [
  "Partnered with reliable, licensed insurance providers",
  "Third-Party, Commercial, and Comprehensive cover available",
  "Plans from as low as KES 1,000",
  "Straightforward quote process — no hidden fees",
  "Support choosing the right cover for your vehicle",
  "Available whether you bought your car with us or not",
];

// Purely additive under the existing "Our Services" navigation — a sibling
// to the other five /services/* pages, but built as its own page (not
// ServicePageLayout) since its centerpiece is a dynamic admin-managed list
// of policy cards ordered ahead of the benefits/CTA sections, per spec.
// The benefits box and Chat/Call CTA below reuse the exact same markup
// pattern as ServicePageLayout's own sections, so the branding stays
// consistent even though this page's layout isn't literally that component.
export default async function CarInsurancePage() {
  const policies = await getPublishedInsurancePolicies();

  const whatsappHref = `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(
    `Hi, I'd like to know more about Car Insurance Cover on ${siteConfig.name}.`
  )}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          Motor Insurance
        </span>
        <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Car Insurance Cover</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
          Grounded Cars has partnered with reliable insurance companies to help you obtain
          Third-Party, Commercial, and Comprehensive motor insurance policies — with plans starting
          from as low as KES 1,000.
        </p>
      </div>

      <div className="mt-12">
        {policies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="font-medium text-slate-700">No insurance policies published yet.</p>
            <p className="mt-1 text-sm text-slate-500">Check back soon, or contact us directly below.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {policies.map((policy) => (
              <InsurancePolicyCard
                key={policy.id}
                policy={{
                  id: policy.id,
                  title: policy.title,
                  description: policy.description,
                  startingPrice: Number(policy.startingPrice),
                  currency: policy.currency,
                  imageUrl: policy.imageUrl,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-16 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Why insure through Grounded Cars
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5 text-sm text-slate-700">
              <CheckIcon />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-brand/20 bg-brand/5 p-6">
        <div className="flex-1">
          <p className="font-semibold text-slate-900">Ready to get covered?</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Chat with our team and we&apos;ll help you find the right policy.
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

      <p className="mt-6 text-center text-sm text-slate-500">
        Also looking for a car?{" "}
        <Link href="/cars" className="font-medium text-brand hover:underline">
          Browse verified listings
        </Link>
        .
      </p>
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
