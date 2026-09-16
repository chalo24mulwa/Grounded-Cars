import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";
import { UtilityBar } from "@/components/layout/UtilityBar";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ReviewsCta } from "@/components/layout/ReviewsCta";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";

export const metadata: Metadata = {
  // Lets every child page's relative Open Graph/canonical URLs (see
  // cars/[slug]/page.tsx's generateMetadata) resolve to absolute ones
  // without each page needing to know or repeat the site's own origin.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: siteConfig.legalName,
    // "Kenya" in every page's title suffix, not just the brand name, is
    // real local-SEO value for a Kenya-only marketplace — every page
    // that doesn't opt out via `title.absolute` (homepage, about-us)
    // gets it for free.
    template: `%s | ${siteConfig.legalName}`,
  },
  description: siteConfig.description,
};

// Site-wide, static structured data — identical on every page, so it lives
// once here rather than being repeated per-page. Every value is either a
// real, fixed site fact (name, URL, logo, contact number) or a real
// capability (the search box actually works at /cars?q=...) — nothing
// fabricated (no ratings/reviews here; those already live, generated from
// real data, on the /reviews page itself).
function buildSiteJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteConfig.legalName,
      url: baseUrl,
      logo: `${baseUrl}${siteConfig.logo.colored}`,
      contactPoint: {
        "@type": "ContactPoint",
        telephone: siteConfig.contactPhone,
        contactType: "customer service",
        areaServed: "KE",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.legalName,
      url: baseUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: `${baseUrl}/cars?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- static site config only, never user input
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSiteJsonLd()) }}
        />
        <ImpersonationBanner />
        <UtilityBar />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <ReviewsCta />
        <SiteFooter />
        <WhatsAppButton />
      </body>
    </html>
  );
}
