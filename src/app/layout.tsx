import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";
import { Suspense } from "react";
import { FavoritesCookieSeed } from "@/components/listings/FavoritesCookieSeed";
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
  // <meta name="application-name">: another explicit statement of the
  // site's name for anything that reads it.
  applicationName: siteConfig.name,
  title: {
    // Used by any page that doesn't set its own title.
    default: siteConfig.homeTitle,
    // Every page that doesn't opt out via `title.absolute` (homepage,
    // about-us, the make/location landing pages) ends with the ONE official
    // brand name — "Car Marketplace", never a variant — so the same name
    // repeats across every result Google shows for this site.
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  // Defaults for every page's link preview. Pages that set their own
  // `openGraph` replace this object wholesale (Next.js doesn't merge nested
  // metadata objects), so each of those repeats `siteName` itself.
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: "en_KE",
    images: [siteConfig.shareImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [siteConfig.shareImage.url],
  },
  // Renders as <meta name="google-site-verification" content="..." /> —
  // proves domain ownership for Google Search Console. Public by design
  // (this is literally how the HTML-tag verification method works), so
  // there's nothing sensitive about committing it.
  verification: {
    google: "xOG5JJ1Cnrt8X6343_9Firlcae11Cx2c-yX4ueUwWYQ",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <ImpersonationBanner />
        <UtilityBar />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <ReviewsCta />
        <SiteFooter />
        <WhatsAppButton />
        <Suspense fallback={null}>
          <FavoritesCookieSeed />
        </Suspense>
      </body>
    </html>
  );
}
