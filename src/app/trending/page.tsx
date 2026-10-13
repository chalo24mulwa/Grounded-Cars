import type { Metadata } from "next";
import { listFeed } from "@/server/services/trending/video-service";
import { getViewerProfile } from "@/server/services/trending/profile-service";
import { TrendingFeed } from "@/components/trending/TrendingFeed";

export const metadata: Metadata = {
  title: "Trending car videos",
  description: "Watch, like and share the latest car videos from Kenyan drivers, sellers and dealers on Car Marketplace.",
  alternates: { canonical: "/trending" },
};

// Per-viewer (likes, blocks), so always rendered fresh.
export const dynamic = "force-dynamic";

export default async function TrendingPage() {
  const [{ videos, nextCursor }, viewer] = await Promise.all([listFeed(null), getViewerProfile()]);
  return <TrendingFeed initialVideos={videos} initialCursor={nextCursor} signedIn={Boolean(viewer)} />;
}
