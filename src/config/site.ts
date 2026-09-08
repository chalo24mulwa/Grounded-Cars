// Single source of truth for site-identity values (name, contact, brand
// assets). Nothing here is a secret — this is public marketing/config data,
// safe to import from both server and client components. Keeping it in one
// module means a future rebrand or contact-number change touches one file,
// not every page that mentions the business.

export const siteConfig = {
  name: "Car Marketplace",
  legalName: "Car Marketplace Kenya",
  description: "Buy and sell vehicles across Kenya.",
  contactPhone: "+254719838935",
  // wa.me requires international format with no "+", spaces, or leading 0 —
  // derived here so the two numbers can never drift out of sync.
  whatsappNumber: "254719838935",
  logo: {
    // Full-color wordmark — use on light backgrounds (headers, print).
    colored: "/brand/logo-colored.svg",
    // Background-agnostic mark — use on dark surfaces or over photos.
    transparent: "/brand/logo.svg",
  },
} as const;
