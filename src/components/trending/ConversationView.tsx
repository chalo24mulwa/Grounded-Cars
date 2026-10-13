"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { MessageView } from "@/server/services/trending/message-service";
import { pollConversationAction, sendMessageAction, setBlockedAction } from "@/server/actions/trending-actions";
import { Avatar, Icon, timeAgo } from "@/components/trending/ui";
import { MESSAGE_MAX } from "@/lib/trending/config";

/** One private conversation. New messages arrive by polling every 4 s while
 * the page is visible. */
export function ConversationView({
  conversationId,
  other,
  blocked: initiallyBlocked,
  initialMessages,
  videoRefId,
}: {
  conversationId: string;
  other: { id: string; username: string; displayName: string; avatarUrl: string | null };
  blocked: boolean;
  initialMessages: MessageView[];
  videoRefId: string | null;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [pending, start] = useTransition();
  const [attachVideo, setAttachVideo] = useState(videoRefId);
  const listRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(initialMessages.at(-1)?.createdAt ?? null);

  useLayoutEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const poll = useCallback(async () => {
    const r = await pollConversationAction(conversationId, lastRef.current);
    if (!r.ok || r.data.messages.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = r.data.messages.filter((m) => !seen.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    lastRef.current = r.data.messages.at(-1)?.createdAt ?? lastRef.current;
  }, [conversationId]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 4000);
    return () => clearInterval(id);
  }, [poll]);

  function send() {
    if (!text.trim()) return;
    start(async () => {
      const r = await sendMessageAction(conversationId, text, attachVideo);
      if (!r.ok) return setError(r.error);
      setText("");
      setError(null);
      setAttachVideo(null);
      await poll();
    });
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-150px)] max-w-lg flex-col bg-white sm:my-4 sm:h-[70vh] sm:rounded-xl sm:border sm:border-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-100 px-3 py-2">
        <Link href="/trending/messages" aria-label="Back to messages" className="rounded-full p-1 text-slate-600 hover:bg-slate-100">
          <Icon name="back" size={22} />
        </Link>
        <Link href={`/trending/u/${other.username}`} className="flex min-w-0 items-center gap-2">
          <Avatar src={other.avatarUrl} name={other.displayName} size={36} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{other.displayName}</span>
            <span className="block truncate text-xs text-slate-500">@{other.username}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() =>
            start(async () => {
              if (!blocked && !window.confirm(`Block @${other.username}? They won't be able to message you.`)) return;
              const r = await setBlockedAction(other.id, !blocked);
              if (r.ok) setBlocked(!blocked);
            })
          }
          className="ml-auto text-xs font-semibold text-slate-500 hover:text-red-600"
        >
          {blocked ? "Unblock" : "Block"}
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Say hello 👋</p>}
        {messages.map((m) => (
          <div key={m.id} className={clsx("flex flex-col", m.mine ? "items-end" : "items-start")}>
            {m.video &&
              (m.video.available ? (
                <Link href={`/trending/v/${m.video.id}`} className="mb-1 block h-24 w-16 overflow-hidden rounded-md bg-slate-800">
                  {m.video.poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.video.poster} alt="Video" className="h-full w-full object-cover" />
                  )}
                </Link>
              ) : (
                <span className="mb-1 rounded-md bg-slate-100 px-2 py-1 text-xs italic text-slate-500">This video is no longer available</span>
              ))}
            <p
              className={clsx(
                "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                m.mine ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-slate-100 text-slate-900"
              )}
            >
              {m.body}
            </p>
            <span className="mt-0.5 text-[10px] text-slate-400">
              {timeAgo(m.createdAt)}
              {m.mine && m.readAt ? " · Seen" : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 p-3">
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        {blocked ? (
          <p className="text-center text-sm text-slate-500">You can&apos;t message this account.</p>
        ) : (
          <>
            {attachVideo && (
              <p className="mb-2 flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                About their video
                <button type="button" className="font-semibold" onClick={() => setAttachVideo(null)}>
                  Remove
                </button>
              </p>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                maxLength={MESSAGE_MAX}
                placeholder="Message…"
                className="max-h-32 min-w-0 flex-1 resize-none rounded-2xl bg-slate-100 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/40"
              />
              <button type="submit" disabled={pending || !text.trim()} aria-label="Send" className="rounded-full bg-brand-accent p-2.5 text-white disabled:opacity-40">
                <Icon name="send" size={18} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
