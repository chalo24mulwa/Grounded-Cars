import type { Metadata } from "next";
import Link from "next/link";
import { getVideoForPage } from "@/server/services/trending/video-service";
import { getViewerProfile } from "@/server/services/trending/profile-service";
import { TrendingFeed } from "@/components/trending/TrendingFeed";
import { expiresIn } from "@/components/trending/ui";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// Shared links land here. Open Graph tags give WhatsApp/Facebook/etc. a
// title and thumbnail preview while the video exists.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getVideoForPage(id);
  if (result.state !== "ok") {
    return { title: "This video has expired", robots: { index: false } };
  }
  const v = result.video;
  const title = v.title || `${[v.year, v.make, v.model].filter(Boolean).join(" ") || "Car video"} by @${v.author.username}`;
  const description = v.caption.slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: `/trending/v/${v.id}` },
    openGraph: {
      type: "video.other",
      siteName: siteConfig.name,
      title,
      description,
      url: `/trending/v/${v.id}`,
      images: v.poster ? [{ url: v.poster, width: 480, alt: title }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: v.poster ? [v.poster] : undefined },
  };
}

export default async function TrendingVideoPage({ params }: Props) {
  const { id } = await params;
  const [result, viewer] = await Promise.all([getVideoForPage(id), getViewerProfile()]);

  if (result.state === "gone") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <p className="text-5xl" aria-hidden="true">⏱️</p>
        <h1 className="mt-4 text-xl font-bold text-slate-900">This video has expired</h1>
        <p className="mt-2 text-sm text-slate-600">
          Trending videos are available for 7 days after they&apos;re posted, or this one was removed by its owner.
        </p>
        <Link href="/trending" className="mt-6 rounded-full bg-brand-accent px-5 py-2 text-sm font-semibold text-white">
          Watch the latest videos
        </Link>
      </div>
    );
  }

  if (result.state === "processing") {
    const v = result.video;
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">{v.status === "FAILED" ? "This video couldn't be published" : "Processing…"}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {v.status === "FAILED"
            ? (v.failureReason ?? "Something went wrong while processing it.")
            : "We're resizing your video so it plays fast on every phone. It will appear in the feed when it's ready."}
        </p>
        <p className="mt-2 text-xs text-slate-500">{expiresIn(v.expiresAt)}</p>
        <Link href={`/trending/u/${v.author.username}`} className="mt-6 inline-block text-sm font-semibold text-brand">
          Go to my videos
        </Link>
      </div>
    );
  }

  return <TrendingFeed initialVideos={[result.video]} initialCursor={null} signedIn={Boolean(viewer)} continueWithFeed />;
}
