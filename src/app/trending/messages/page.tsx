import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerProfile } from "@/server/services/trending/profile-service";
import { listMyConversations } from "@/server/services/trending/message-service";
import { Avatar, timeAgo } from "@/components/trending/ui";
import { InboxAutoRefresh } from "@/components/trending/InboxAutoRefresh";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TrendingInboxPage() {
  const me = await getViewerProfile();
  if (!me) redirect(`/login?callbackUrl=${encodeURIComponent("/trending/messages")}`);
  const conversations = await listMyConversations();

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <InboxAutoRefresh />
      <h1 className="text-xl font-bold text-slate-900">Messages</h1>
      {conversations.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          No messages yet. Tap the message button on a video to contact its poster.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/trending/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <Avatar src={c.other.avatarUrl} name={c.other.displayName} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{c.other.displayName}</span>
                    {c.lastMessage && <span className="shrink-0 text-xs text-slate-400">{timeAgo(c.lastMessage.createdAt)}</span>}
                  </p>
                  <p className={`truncate text-sm ${c.unread ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                    {c.lastMessage ? `${c.lastMessage.mine ? "You: " : ""}${c.lastMessage.body}` : ""}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="rounded-full bg-brand-accent px-2 py-0.5 text-xs font-bold text-white">{c.unread}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
