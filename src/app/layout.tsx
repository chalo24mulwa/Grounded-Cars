import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";
import { UtilityBar } from "@/components/layout/UtilityBar";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";

export const metadata: Metadata = {
  // Lets every child page's relative Open Graph/canonical URLs (see
  // cars/[slug]/page.tsx's generateMetadata) resolve to absolute ones
  // without each page needing to know or repeat the site's own origin.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: siteConfig.legalName,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <ImpersonationBanner />
        <UtilityBar />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <WhatsAppButton />
      </body>
    </html>
  );
}
