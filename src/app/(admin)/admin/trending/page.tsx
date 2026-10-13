import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isTrendingEnabled, videoTtlHours } from "@/lib/trending/config";
import { isMuxConfigured } from "@/lib/trending/mux";
import { listReports } from "@/server/services/trending/moderation-service";
import { getTrendingStorageStats } from "@/server/services/trending/cleanup-service";
import { TrendingAdminControls, RunCleanupButton } from "@/components/admin/TrendingAdminControls";

export const metadata: Metadata = { title: "Trending moderation" };
export const dynamic = "force-dynamic";

export default async function AdminTrendingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!isTrendingEnabled()) notFound();
  const { status: rawStatus } = await searchParams;
  const status = rawStatus === "RESOLVED" || rawStatus === "DISMISSED" ? rawStatus : "OPEN";
  const [reports, stats] = await Promise.all([listReports(status), getTrendingStorageStats()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Trending</h1>
        <p className="mt-1 text-sm text-slate-600">
          Videos are deleted completely {videoTtlHours() / 24 === 7 ? "7 days" : `${videoTtlHours()} hours`} after posting (checked every hour).
          {!isMuxConfigured() && <strong className="text-red-600"> Mux is not configured — uploads and deletions can&apos;t run.</strong>}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Videos showing now", value: stats.liveVideos },
          { label: "Processing", value: stats.processingVideos },
          { label: "Awaiting deletion", value: stats.awaitingDeletion },
          { label: "Stored at Mux (min)", value: stats.storedMinutes },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </section>
      <RunCleanupButton />

      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
          {(["OPEN", "RESOLVED", "DISMISSED"] as const).map((s) => (
            <Link
              key={s}
              href={`/admin/trending?status=${s}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${s === status ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
        {reports.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No {status.toLowerCase()} reports.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {r.targetType === "VIDEO" ? "Video" : r.targetType === "COMMENT" ? "Comment" : "Account"} · {r.reason}
                  </p>
                  <p className="text-xs text-slate-500">
                    by @{r.reporter.username} · {r.createdAt.toLocaleString("en-KE")}
                  </p>
                </div>
                {r.details && <p className="mt-1 text-sm text-slate-600">“{r.details}”</p>}
                <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  {r.video ? (
                    <>
                      <Link href={`/trending/v/${r.video.id}`} className="font-medium text-brand hover:underline">
                        Open video
                      </Link>{" "}
                      by @{r.video.profile.username}: {r.video.caption.slice(0, 200)}
                    </>
                  ) : r.comment ? (
                    <>
                      @{r.comment.author.username}: {r.comment.body}
                    </>
                  ) : r.profile ? (
                    <>
                      <Link href={`/trending/u/${r.profile.username}`} className="font-medium text-brand hover:underline">
                        @{r.profile.username}
                      </Link>{" "}
                      ({r.profile.displayName}){r.profile.postingSuspended ? " — posting suspended" : ""}
                    </>
                  ) : (
                    <em>This content has already been deleted or has expired.</em>
                  )}
                </div>
                {status === "OPEN" && (
                  <TrendingAdminControls
                    reportId={r.id}
                    videoId={r.video?.id ?? null}
                    commentId={r.comment?.id ?? null}
                    offenderProfileId={r.video?.profile.id ?? r.comment?.author.id ?? r.profile?.id ?? null}
                    offenderSuspended={r.profile?.postingSuspended ?? false}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
