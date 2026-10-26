import { ServicePageLayout } from "@/components/services/ServicePageLayout";
import { ServiceOrderPanel } from "@/components/services/ServiceOrderPanel";
import { getPublishedServiceBySlug } from "@/server/services/service-catalog-service";
import { isMpesaConfigured } from "@/lib/mpesa";

export const metadata = {
  title: "Car Valuation",
  description: "Get an accurate, market-based valuation of your vehicle before you sell or trade it in.",
  alternates: { canonical: "/services/car-valuation" },
};

// Fetches its own orderable Service (if an admin has created and published
// one for this page) purely additively — see ServicePageLayout's
// `children` slot and ServiceOrderPanel's own comment. When none exists,
// `service` is null and nothing renders beyond this page's existing
// content, unchanged.
export default async function CarValuationPage() {
  const service = await getPublishedServiceBySlug("car-valuation");

  return (
    <ServicePageLayout
      eyebrow="Know what it's worth"
      title="Car Valuation"
      serviceName="Car Valuation"
      heroImage={{
        src: "/images/services/car-valuation-hero.jpg",
        alt: "Grounded Cars expert valuation services — transparent, fast, reliable. Unlock your car's true value.",
      }}
      intro="Selling or trading in your car? Get an honest, market-based valuation first — so you can price it competitively and negotiate with confidence, instead of guessing."
      benefits={[
        "Based on real marketplace sale data, not guesswork",
        "Accounts for make, model, year, mileage, and condition",
        "Free estimate, no obligation to list or sell",
        "Helps you price competitively from day one",
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
