"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  listCommentsAction,
  addCommentAction,
  deleteCommentAction,
  editCommentAction,
  setCommentLikeAction,
} from "@/server/actions/trending-actions";
import type { CommentView } from "@/server/services/trending/interaction-service";
import { BottomSheet } from "@/components/trending/BottomSheet";
import { ReportSheet } from "@/components/trending/ReportSheet";
import { Avatar, Icon, formatCount, timeAgo } from "@/components/trending/ui";
import { COMMENT_MAX } from "@/lib/trending/config";

export function CommentsSheet({
  videoId,
  count,
  signedIn,
  loginHref,
  onClose,
  onCountChange,
}: {
  videoId: string;
  count: number;
  signedIn: boolean;
  loginHref: string;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}) {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (next: string | null) => {
      const result = await listCommentsAction(videoId, null, next);
      if (!result.ok) return setError(result.error);
      setComments((prev) => (next ? [...prev, ...result.data.comments] : result.data.comments));
      setCursor(result.data.nextCursor);
      setLoaded(true);
    },
    [videoId]
  );

  useEffect(() => {
    void load(null);
  }, [load, refreshKey]);

  function submit() {
    if (!text.trim()) return;
    start(async () => {
      const result = await addCommentAction(videoId, text, replyTo?.id ?? null);
      if (!result.ok) return setError(result.error);
      setText("");
      setError(null);
      onCountChange(1);
      setReplyTo(null);
      setRefreshKey((k) => k + 1);
    });
  }

  return (
    <BottomSheet title={`${formatCount(count)} comment${count === 1 ? "" : "s"}`} onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {!loaded && <p className="py-8 text-center text-sm text-slate-400">Loading…</p>}
        {loaded && comments.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No comments yet. Start the conversation!</p>
        )}
        <ul className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              videoId={videoId}
              signedIn={signedIn}
              loginHref={loginHref}
              onReply={(c) => {
                setReplyTo({ id: c.id, username: c.author.username });
                inputRef.current?.focus();
              }}
              onRemoved={(n) => {
                onCountChange(-n);
                setRefreshKey((k) => k + 1);
              }}
              refreshKey={refreshKey}
            />
          ))}
        </ul>
        {cursor && (
          <button type="button" onClick={() => load(cursor)} className="mx-auto my-3 block text-sm font-medium text-brand">
            Load more comments
          </button>
        )}
      </div>

      <div className="border-t border-slate-100 p-3">
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        {signedIn ? (
          <>
            {replyTo && (
              <div className="mb-2 flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                Replying to @{replyTo.username}
                <button type="button" onClick={() => setReplyTo(null)} className="font-semibold">
                  Cancel
                </button>
              </div>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={COMMENT_MAX}
                placeholder={replyTo ? "Add a reply…" : "Add a comment…"}
                className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/40"
              />
              <button
                type="submit"
                disabled={pending || !text.trim()}
                aria-label="Post comment"
                className="rounded-full bg-brand-accent p-2 text-white disabled:opacity-40"
              >
                <Icon name="send" size={18} />
              </button>
            </form>
          </>
        ) : (
          <Link href={loginHref} className="block rounded-full bg-slate-100 px-4 py-2 text-center text-sm font-medium text-slate-700">
            Log in to comment
          </Link>
        )}
      </div>
    </BottomSheet>
  );
}

function CommentItem({
  comment,
  videoId,
  signedIn,
  loginHref,
  onReply,
  onRemoved,
  refreshKey,
  isReply = false,
}: {
  comment: CommentView;
  videoId: string;
  signedIn: boolean;
  loginHref: string;
  onReply: (c: CommentView) => void;
  onRemoved: (count: number) => void;
  refreshKey: number;
  isReply?: boolean;
}) {
  const [liked, setLiked] = useState(comment.likedByMe);
  const [likes, setLikes] = useState(comment.likeCount);
  const [replies, setReplies] = useState<CommentView[] | null>(null);
  const [repliesCursor, setRepliesCursor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [draft, setDraft] = useState(comment.body);
  const [reporting, setReporting] = useState(false);
  const [, start] = useTransition();

  // Keep an open replies list fresh after someone posts a reply.
  useEffect(() => {
    if (replies !== null && !isReply) {
      listCommentsAction(videoId, comment.id, null).then((r) => {
        if (r.ok) {
          setReplies(r.data.comments);
          setRepliesCursor(r.data.nextCursor);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function loadReplies(cursor: string | null) {
    const r = await listCommentsAction(videoId, comment.id, cursor);
    if (r.ok) {
      setReplies((prev) => (cursor && prev ? [...prev, ...r.data.comments] : r.data.comments));
      setRepliesCursor(r.data.nextCursor);
    }
  }

  return (
    <li>
      <div className="flex gap-3">
        <Link href={`/trending/u/${comment.author.username}`}>
          <Avatar src={comment.author.avatarUrl} name={comment.author.displayName} size={isReply ? 28 : 36} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500">
            <Link href={`/trending/u/${comment.author.username}`}>@{comment.author.username}</Link>
          </p>
          {editing ? (
            <form
              className="mt-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await editCommentAction(comment.id, draft);
                  if (r.ok) {
                    setBody(draft.trim());
                    setEditing(false);
                  }
                });
              }}
            >
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={COMMENT_MAX} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
              <button className="text-xs font-semibold text-brand">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-500">
                Cancel
              </button>
            </form>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{body}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>{timeAgo(comment.createdAt)}</span>
            {signedIn && (
              <button type="button" onClick={() => onReply(comment)} className="font-semibold">
                Reply
              </button>
            )}
            {comment.canEdit && !editing && (
              <button type="button" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {comment.canDelete && (
              <button
                type="button"
                onClick={() =>
                  start(async () => {
                    if (!window.confirm("Delete this comment?")) return;
                    const r = await deleteCommentAction(comment.id);
                    if (r.ok) onRemoved(1 + (isReply ? 0 : comment.replyCount));
                  })
                }
              >
                Delete
              </button>
            )}
            {signedIn && !comment.canEdit && (
              <button type="button" onClick={() => setReporting(true)}>
                Report
              </button>
            )}
          </div>
          {!isReply && comment.replyCount > 0 && replies === null && (
            <button type="button" onClick={() => loadReplies(null)} className="mt-2 text-xs font-semibold text-slate-500">
              — View {comment.replyCount} repl{comment.replyCount === 1 ? "y" : "ies"}
            </button>
          )}
          {replies && (
            <ul className="mt-3 space-y-3">
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  videoId={videoId}
                  signedIn={signedIn}
                  loginHref={loginHref}
                  onReply={() => onReply(comment)}
                  onRemoved={onRemoved}
                  refreshKey={refreshKey}
                  isReply
                />
              ))}
              {repliesCursor && (
                <button type="button" onClick={() => loadReplies(repliesCursor)} className="text-xs font-semibold text-slate-500">
                  View more replies
                </button>
              )}
            </ul>
          )}
        </div>
        <div className="flex flex-col items-center pt-3 text-slate-400">
          {signedIn ? (
            <button
              type="button"
              aria-label={liked ? "Unlike comment" : "Like comment"}
              aria-pressed={liked}
              onClick={() => {
                const next = !liked;
                setLiked(next);
                setLikes((n) => n + (next ? 1 : -1));
                start(async () => {
                  const r = await setCommentLikeAction(comment.id, next);
                  if (r.ok) setLikes(r.data.likeCount);
                  else {
                    setLiked(!next);
                    setLikes((n) => n + (next ? -1 : 1));
                  }
                });
              }}
              className={clsx(liked && "text-red-500")}
            >
              <Icon name="heart" size={16} filled={liked} />
            </button>
          ) : (
            <Link href={loginHref} aria-label="Log in to like">
              <Icon name="heart" size={16} />
            </Link>
          )}
          <span className="text-[11px]">{likes > 0 ? formatCount(likes) : ""}</span>
        </div>
      </div>
      {reporting && <ReportSheet targetType="COMMENT" targetId={comment.id} onClose={() => setReporting(false)} />}
    </li>
  );
}
