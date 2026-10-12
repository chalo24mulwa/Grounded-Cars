import Image from "next/image";
import { getPublishedCsrInitiatives } from "@/server/services/csr-service";
import { CsrInitiativeCard } from "@/components/csr/CsrInitiativeCard";

export const metadata = {
  title: "Corporate Social Responsibility",
  description:
    "Community initiatives from Car Marketplace — outreach, food support, and support for street-connected children across Kenya.",
  alternates: { canonical: "/csr" },
};

export default async function CsrPage() {
  const initiatives = await getPublishedCsrInitiatives();

  return (
    <div>
      {/* Hero banner — the image itself already carries the headline, intro
          copy, and CTA baked in (see public/images/csr/hero.jpg), so this is
          rendered plain (no overlay) at its native aspect ratio to avoid
          ever cropping that baked-in text. The page's own heading/intro
          copy follows below the image, not on top of it. */}
      <section className="w-full bg-slate-900">
        <Image
          src="/images/csr/hero.jpg"
          alt="Together we can make a difference — Car Marketplace CSR: supporting vulnerable groups, feeding street children, community outreach."
          width={1717}
          height={916}
          priority
          className="h-auto w-full"
          sizes="100vw"
        />
      </section>

      <section className="border-b border-slate-200 bg-brand-mist">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Our Corporate Social Responsibility
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Beyond buying and selling cars, Car Marketplace supports vulnerable communities across
            Kenya — community outreach, food support, and care for homeless and street-connected
            children. Every donation goes directly toward these initiatives.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {initiatives.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="font-medium text-slate-700">No CSR initiatives published yet.</p>
            <p className="mt-1 text-sm text-slate-500">Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {initiatives.map((initiative) => (
              <CsrInitiativeCard
                key={initiative.id}
                initiative={{
                  slug: initiative.slug,
                  title: initiative.title,
                  summary: initiative.summary,
                  coverImageUrl: initiative.coverImageUrl,
                  targetAmount: Number(initiative.targetAmount),
                  amountRaised: Number(initiative.amountRaised),
                  currency: initiative.currency,
                  status: initiative.status,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
