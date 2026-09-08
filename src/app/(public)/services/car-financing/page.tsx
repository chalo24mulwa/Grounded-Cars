import { ServicePageLayout } from "@/components/services/ServicePageLayout";
import { ServiceOrderPanel } from "@/components/services/ServiceOrderPanel";
import { getPublishedServiceBySlug } from "@/server/services/service-catalog-service";
import { isMpesaConfigured } from "@/lib/mpesa";

export const metadata = {
  title: "Car Financing",
  description: "Connect with trusted lending partners for flexible, fast car financing across Kenya.",
  alternates: { canonical: "/services/car-financing" },
};

// Fetches its own orderable Service (if an admin has created and published
// one for this page) purely additively — see ServicePageLayout's
// `children` slot and ServiceOrderPanel's own comment. When none exists,
// `service` is null and nothing renders beyond this page's existing
// content, unchanged.
export default async function CarFinancingPage() {
  const service = await getPublishedServiceBySlug("car-financing");

  return (
    <ServicePageLayout
      eyebrow="Buy now, pay over time"
      title="Car Financing"
      serviceName="Car Financing"
      heroImage={{
        src: "/images/services/car-financing-hero.jpg",
        alt: "Car Marketplace car financing — logbook loans, purchase financing, import financing, and repair financing",
      }}
      intro="Found the right car but need financing to close the deal? We connect you with trusted lending partners for asset and logbook financing, matched to your budget and repayment ability."
      benefits={[
        "Competitive rates from vetted lending partners",
        "Fast approval — often within a few business days",
        "Flexible repayment terms to match your budget",
        "No obligation to accept any offer you're matched with",
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
