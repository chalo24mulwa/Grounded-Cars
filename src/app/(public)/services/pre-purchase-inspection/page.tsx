import { ServicePageLayout } from "@/components/services/ServicePageLayout";
import { ServiceOrderPanel } from "@/components/services/ServiceOrderPanel";
import { getPublishedServiceBySlug } from "@/server/services/service-catalog-service";
import { isMpesaConfigured } from "@/lib/mpesa";

export const metadata = {
  title: "Pre-Purchase Car Inspection in Kenya",
  description: "Get a certified mechanic in Kenya to inspect a car before you buy it — engine, chassis, electricals, and accident history — arranged through Grounded Cars.",
  alternates: { canonical: "/services/pre-purchase-inspection" },
};

// Fetches its own orderable Service (if an admin has created and published
// one for this page) purely additively — see ServicePageLayout's
// `children` slot and ServiceOrderPanel's own comment. When none exists,
// `service` is null and nothing renders beyond this page's existing
// content, unchanged.
export default async function PrePurchaseInspectionPage() {
  const service = await getPublishedServiceBySlug("pre-purchase-inspection");

  return (
    <ServicePageLayout
      eyebrow="Buyer protection"
      title="Pre-Purchase Inspection"
      serviceName="Pre-Purchase Inspection"
      heroImage={{
        src: "/images/services/pre-purchase-inspection-hero.jpg",
        alt: "Grounded Cars pre-purchase car inspection — only KSH 1,000, checking engine performance, transmission, brakes, electrical, body and interior condition, fluids and leaks, and a road test",
        width: 1024,
        height: 1536,
      }}
      intro="Don't buy a car on faith. Have an independent, certified mechanic inspect it first — engine, chassis, electricals, and accident history — so you know exactly what you're paying for before you commit."
      benefits={[
        "Comprehensive 100+ point mechanical and safety checklist",
        "Independent, certified mechanics — not the seller's own",
        "Detailed written report, usually within 24 hours",
        "Accident and major-repair history check where available",
        "Peace of mind before you hand over payment",
      ]}
    >
      {service && (
        <ServiceOrderPanel
          service={{
            id: service.id,
            title: service.title,
            description: service.description,
            price: Number(service.price),
            currency: service.currency,
            images: service.images,
          }}
          mpesaConfigured={isMpesaConfigured()}
          isDev={process.env.NODE_ENV !== "production"}
        />
      )}
    </ServicePageLayout>
  );
}
