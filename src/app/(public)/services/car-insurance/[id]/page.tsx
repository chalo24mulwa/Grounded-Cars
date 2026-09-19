import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedInsurancePolicyById } from "@/server/services/insurance-service";
import { isMpesaConfigured } from "@/lib/mpesa";
import { InsurancePurchaseForm } from "@/components/insurance/InsurancePurchaseForm";
import { siteConfig } from "@/config/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const policy = await getPublishedInsurancePolicyById(id);
  if (!policy) return {};

  const description =
    policy.description.length > 160 ? `${policy.description.slice(0, 157)}...` : policy.description;
  return {
    title: policy.title,
    description,
    alternates: { canonical: `/services/car-insurance/${policy.id}` },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: policy.title,
      description,
      images: policy.imageUrl ? [{ url: policy.imageUrl }] : [siteConfig.shareImage],
    },
  };
}

export default async function InsurancePolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const policy = await getPublishedInsurancePolicyById(id);
  if (!policy) notFound();

  const whatsappHref = `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(
    `Hi, I have a question about ${policy.title} on ${siteConfig.name}.`
  )}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/services/car-insurance" className="text-sm font-medium text-brand hover:underline">
        ← All insurance policies
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {policy.imageUrl ? (
              <Image src={policy.imageUrl} alt={policy.title} fill unoptimized className="object-cover" sizes="(max-width: 1024px) 100vw, 60vw" priority />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">Car Marketplace</div>
            )}
          </div>

          <h1 className="mt-6 text-2xl font-bold text-slate-900 sm:text-3xl">{policy.title}</h1>
          <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-700">{policy.description}</p>

          <p className="mt-6 text-sm text-slate-500">
            Have a question first?{" "}
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
              Chat with us on WhatsApp
            </a>
            .
          </p>
        </div>

        <div className="lg:col-span-2">
          {/* Matches the sticky offset used by the /cars and /best-deals
              filter sidebars and the CSR detail page's donate panel — see
              those for the shared math. */}
          <div className="lg:sticky lg:top-[127px] space-y-6">
            <InsurancePurchaseForm
              policyId={policy.id}
              price={Number(policy.startingPrice)}
              currency={policy.currency}
              mpesaConfigured={isMpesaConfigured()}
              isDev={process.env.NODE_ENV !== "production"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
