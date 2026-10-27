import { ServicePageLayout } from "@/components/services/ServicePageLayout";
import { ServiceOrderPanel } from "@/components/services/ServiceOrderPanel";
import { getPublishedServiceBySlug } from "@/server/services/service-catalog-service";
import { isMpesaConfigured } from "@/lib/mpesa";

export const metadata = {
  title: "Car Tracking in Kenya",
  description: "Install GPS tracking on your vehicle in Kenya for real-time location, theft alerts, and driver insights — via Grounded Cars.",
  alternates: { canonical: "/services/car-tracking" },
};

// Fetches its own orderable Service (if an admin has created and published
// one for this page) purely additively — see ServicePageLayout's
// `children` slot and ServiceOrderPanel's own comment. When none exists,
// `service` is null and nothing renders beyond this page's existing
// content, unchanged.
export default async function CarTrackingPage() {
  const service = await getPublishedServiceBySlug("car-tracking");

  return (
    <ServicePageLayout
      eyebrow="Stay in control"
      title="Car Tracking"
      serviceName="Car Tracking"
      heroImage={{
        src: "/images/services/car-tracking-hero.jpg",
        alt: "Grounded Cars GPS tracking — secure your car, always in sight. Real-time monitoring, theft protection, and peaceful ownership.",
      }}
      intro="Protect your vehicle and stay informed with a professionally installed GPS tracker — know where it is, get alerted if it moves somewhere it shouldn't, and keep an eye on how it's being driven."
      benefits={[
        "Real-time GPS location from your phone",
        "Geo-fencing and speed alerts",
        "Theft alerts and remote engine cut-off options",
        "Professional installation, no guesswork",
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
