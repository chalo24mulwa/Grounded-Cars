import { notFound } from "next/navigation";
import { isTrendingEnabled } from "@/lib/trending/config";
import { getViewerProfile } from "@/server/services/trending/profile-service";
import { TrendingNav } from "@/components/trending/TrendingNav";

// Every /trending page goes through here. While TRENDING_ENABLED isn't
// "true" the whole section simply doesn't exist (404) — that's what lets this
// code be deployed before its database tables are created.
export default async function TrendingLayout({ children }: { children: React.ReactNode }) {
  if (!isTrendingEnabled()) notFound();
  const viewer = await getViewerProfile();
  return (
    <div className="bg-slate-50">
      {/* The site's floating WhatsApp button would sit on top of the video
          action buttons, so it's hidden on Trending pages only. */}
      <style>{`a[aria-label="Chat with us on WhatsApp"]{display:none}`}</style>
      <TrendingNav username={viewer?.username ?? null} />
      {children}
    </div>
  );
}
