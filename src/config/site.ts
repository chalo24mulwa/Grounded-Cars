// Single source of truth for site-identity values (name, contact, brand
// assets). Nothing here is a secret — this is public marketing/config data,
// safe to import from both server and client components. Keeping it in one
// module means a future rebrand or contact-number change touches one file,
// not every page that mentions the business.

export const siteConfig = {
  // THE official brand/site name. Every title suffix, footer line, Open Graph
  // site name and structured-data name on the site comes from this one value,
  // so Google sees exactly one consistent name for the site.
  name: "Car Marketplace",
  // A second form of the name people genuinely use and search for. Declared
  // only as the WebSite's alternateName (see lib/structured-data.ts) — it is
  // deliberately never used as a title suffix or brand name, so it can't
  // compete with `name`.
  alternateName: "Car Marketplace Kenya",
  description:
    "Car Marketplace is a Kenyan online marketplace for buying and selling quality used cars, locally used vehicles and fresh imports.",
  // The homepage <title> (also the fallback title for any page without its
  // own): brand first, then what the site is.
  homeTitle: "Car Marketplace | Buy & Sell Cars in Kenya",
  contactPhone: "+254719838935",
  // wa.me requires international format with no "+", spaces, or leading 0 —
  // derived here so the two numbers can never drift out of sync.
  whatsappNumber: "254719838935",
  // Official Car Marketplace social profile URLs, if/when they exist. Each one
  // is emitted as a `sameAs` link in the Organization structured data (which
  // is how Google connects a website to its official profiles). Empty on
  // purpose: none are published anywhere on the site today, and inventing or
  // guessing one would be wrong. Add only real, official URLs here, e.g.
  // "https://www.facebook.com/<your-page>".
  socialProfiles: [] as string[],
  logo: {
    // Full-color wordmark — use on light backgrounds (headers, print).
    colored: "/brand/logo-colored.svg",
    // Background-agnostic mark — use on dark surfaces or over photos.
    transparent: "/brand/logo.svg",
    // 512x512 PNG of the same coloured logo — the raster copy that crawlers
    // and structured data reference (small, universally supported).
    structuredData: "/brand/logo-512.png",
  },
  // 1200x630 share card (the same logo on its own background colour) for
  // Open Graph / Twitter link previews.
  shareImage: {
    url: "/brand/og-image.png",
    width: 1200,
    height: 630,
    alt: "Car Marketplace logo",
  },
} as const;
