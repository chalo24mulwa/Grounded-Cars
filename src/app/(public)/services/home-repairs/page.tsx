import { ServicePageLayout } from "@/components/services/ServicePageLayout";
import { ServiceOrderPanel } from "@/components/services/ServiceOrderPanel";
import { getPublishedServiceBySlug } from "@/server/services/service-catalog-service";
import { isMpesaConfigured } from "@/lib/mpesa";

export const metadata = {
  title: "Home Repairs",
  description: "On-site mechanical repair and maintenance from certified technicians, wherever your car is.",
  alternates: { canonical: "/services/home-repairs" },
};

// Fetches its own orderable Service (if an admin has created and published
// one for this page) purely additively — see ServicePageLayout's
// `children` slot and ServiceOrderPanel's own comment. When none exists,
// `service` is null and nothing renders beyond this page's existing
// content, unchanged.
export default async function HomeRepairsPage() {
  const service = await getPublishedServiceBySlug("home-repairs");

  return (
    <ServicePageLayout
      eyebrow="We come to you"
      title="Home Repairs"
      serviceName="Home Repairs"
      heroImage={{
        src: "/images/services/home-repairs-hero.jpg",
        alt: "Grounded Cars professional car home repair services — comprehensive care for your car, any time, any where.",
        width: 1024,
        height: 572,
        align: "left",
      }}
      intro="Skip the trip to the garage. Get certified technicians to carry out repairs and routine maintenance at your home or office, with genuine parts and transparent, upfront pricing."
      benefits={[
        "Certified technicians for common repairs and servicing",
        "Genuine parts, no guesswork substitutions",
        "Transparent, upfront pricing before work begins",
        "Scheduled at a time that suits you",
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
