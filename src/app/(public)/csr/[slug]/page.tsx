import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedCsrInitiativeBySlug } from "@/server/services/csr-service";
import { isMpesaConfigured } from "@/lib/mpesa";
import { CarImageGallery } from "@/components/listings/CarImageGallery";
import { CsrProgressBar } from "@/components/csr/CsrProgressBar";
import { CsrDonateForm } from "@/components/csr/CsrDonateForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const initiative = await getPublishedCsrInitiativeBySlug(slug);
  if (!initiative) return {};

  return {
    title: initiative.title,
    description: initiative.summary,
    alternates: { canonical: `/csr/${initiative.slug}` },
    openGraph: {
      title: initiative.title,
      description: initiative.summary,
      images: initiative.coverImageUrl ? [{ url: initiative.coverImageUrl }] : undefined,
    },
  };
}

export default async function CsrInitiativeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initiative = await getPublishedCsrInitiativeBySlug(slug);
  if (!initiative) notFound();

  const galleryImages = [
    ...(initiative.coverImageUrl ? [{ imageUrl: initiative.coverImageUrl, altText: initiative.title }] : []),
    ...initiative.images.map((img) => ({ id: img.id, imageUrl: img.imageUrl, altText: img.altText })),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/csr" className="text-sm font-medium text-brand hover:underline">
        ← All CSR initiatives
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {galleryImages.length > 0 ? (
            <CarImageGallery images={galleryImages} title={initiative.title} />
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-400">
              Car Marketplace CSR
            </div>
          )}

          <div className="mt-6">
            <span
              className={
                initiative.status === "ACTIVE"
                  ? "inline-block rounded-full bg-status-active px-2.5 py-1 text-xs font-semibold text-white"
                  : "inline-block rounded-full bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white"
              }
            >
              {initiative.status === "ACTIVE" ? "Active" : "Completed"}
            </span>
            <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">{initiative.title}</h1>
            {(initiative.startDate || initiative.endDate) && (
              <p className="mt-1 text-sm text-slate-500">
                {initiative.startDate?.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                {initiative.endDate
                  ? ` – ${initiative.endDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`
                  : initiative.startDate
                    ? " – ongoing"
                    : ""}
              </p>
            )}
            <p className="mt-6 whitespace-pre-line leading-relaxed text-slate-700">{initiative.story}</p>
          </div>
        </div>

        <div className="lg:col-span-2">
          {/* Matches the sticky offset used by the /cars and /best-deals
              filter sidebars (utility bar + header height + a 33px visual
              gap) — see those pages for the shared math. */}
          <div className="lg:sticky lg:top-[127px] space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <CsrProgressBar
                raised={Number(initiative.amountRaised)}
                target={Number(initiative.targetAmount)}
                currency={initiative.currency}
              />
            </div>

            {initiative.status === "ACTIVE" ? (
              <CsrDonateForm
                initiativeId={initiative.id}
                currency={initiative.currency}
                mpesaConfigured={isMpesaConfigured()}
                isDev={process.env.NODE_ENV !== "production"}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="font-semibold text-slate-700">This initiative has been completed.</p>
                <p className="mt-1 text-sm text-slate-500">Thank you to everyone who donated.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
