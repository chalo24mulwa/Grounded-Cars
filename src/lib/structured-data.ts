import { siteConfig } from "@/config/site";

// ----------------------------------------------------------------------------
// The site's ONE authoritative Organization + WebSite structured data.
//
// It is rendered exactly once, on the homepage (src/app/page.tsx), as a single
// JSON-LD @graph — Google's guidance is to declare the site name and
// organization on the homepage, and repeating (or contradicting) them on
// other pages only creates conflicting signals. Both entities have stable
// @ids so anything else that ever needs to refer to them can point at the
// same entity instead of declaring a second one.
//
// Only real, publicly visible facts go in here: the name, the URL, the
// existing logo file, the phone number shown in the footer/top bar, and the
// fact that the marketplace serves Kenya. No address, registration number,
// social profile, rating or award is included because none exists on the
// site — `sameAs` appears automatically once real profile URLs are added to
// siteConfig.socialProfiles.
// ----------------------------------------------------------------------------

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const HOME_URL = `${SITE_URL}/`;

export const ORGANIZATION_ID = `${HOME_URL}#organization`;
export const WEBSITE_ID = `${HOME_URL}#website`;

export function buildHomepageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: siteConfig.name,
        url: HOME_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}${siteConfig.logo.structuredData}`,
          width: 512,
          height: 512,
        },
        description: siteConfig.description,
        areaServed: { "@type": "Country", name: "Kenya" },
        contactPoint: {
          "@type": "ContactPoint",
          telephone: siteConfig.contactPhone,
          contactType: "customer service",
          areaServed: "KE",
        },
        ...(siteConfig.socialProfiles.length > 0 ? { sameAs: [...siteConfig.socialProfiles] } : {}),
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: siteConfig.name,
        alternateName: siteConfig.alternateName,
        url: HOME_URL,
        description: siteConfig.description,
        inLanguage: "en-KE",
        publisher: { "@id": ORGANIZATION_ID },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/cars?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json"> body. Escapes "<" so no
 * value can ever close the script tag, whatever it contains. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
