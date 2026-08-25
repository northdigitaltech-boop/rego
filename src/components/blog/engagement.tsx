"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Loader2, MessageSquare, Reply, Trash2 } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { supabase } from "@/lib/supabase";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  addComment,
  deleteOwnComment,
  getComments,
  getEngagement,
  timeAgo,
  toggleLike,
  type BlogComment,
} from "@/lib/blog-engagement";
import { cn } from "@/lib/utils";

/* ============================================================
 * Likes and comments.
 *
 * Client components by necessity — both depend on who is signed
 * in, which the server cannot know for a cached page.
 *
 * The article itself stays server-rendered. This sits below it
 * and loads afterwards, so nothing a crawler or a reader needs
 * waits on JavaScript.
 * ============================================================ */

const MAX_COMMENT = 2000;

/* ------------------------------------------------------------------ */
/* Like button                                                         */
/* ------------------------------------------------------------------ */

export function LikeButton({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [likes, setLikes] = React.useState(0);
  const [liked, setLiked] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    getEngagement(postId).then((e) => {
      if (!alive) return;
      setLikes(e.likes);
      setLiked(e.likedByMe);
    });
    return () => {
      alive = false;
    };
  }, [postId, user?.email]);

  const onClick = async () => {
    if (!user) {
      setMsg("Sign in to like this article.");
      return;
    }
    if (busy) return;

    /* Optimistic — the count moves immediately and is put back if the write
       fails. A like that takes a round trip to appear feels broken. */
    const was = liked;
    setLiked(!was);
    setLikes((n) => n + (was ? -1 : 1));
    setBusy(true);
    setMsg("");

    const r = await toggleLike(postId, was);
    if (!r.ok) {
      setLiked(was);
      setLikes((n) => n + (was ? 1 : -1));
      setMsg(r.error ?? "Could not save your like.");
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={liked}
        aria-label={liked ? "Remove like" : "Like this article"}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
          liked
            ? "border-red-300 bg-red-50 text-red-600"
            : "border-border bg-card text-forest hover:border-forest-600 hover:bg-forest-50"
        )}
      >
        <Heart className={cn("h-4 w-4", liked && "fill-red-500 text-red-500")} />
        {likes > 0 ? likes : "Like"}
      </button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

export function Comments({ postId }: { postId: string }) {
  const { user } = useAuth();
  /* The app's User has name/email/role but no auth id, and comments are keyed
     by auth.uid(). Fetched here so "delete my own comment" can be offered to
     the right person — RLS is what actually enforces it. */
  const [uid, setUid] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<BlogComment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [body, setBody] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<BlogComment | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setComments(await getComments(postId));
    setLoading(false);
  }, [postId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUid(data?.user?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [user?.email]);

  /* One level of replies. A deeper tree is unreadable on a phone and hard to
     moderate, so a reply to a reply attaches to the same parent. */
  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    setError("");

    const r = await addComment({
      postId,
      body,
      parentId: replyTo?.parent_id ?? replyTo?.id ?? null,
      authorName: user.name,
      authorAvatar: user.avatar ?? null,
    });

    if (!r.ok) setError(r.error ?? "Could not post your comment.");
    else {
      setBody("");
      setReplyTo(null);
      await load();
    }
    setBusy(false);
  };

  const remove = async (c: BlogComment) => {
    setBusy(true);
    const r = await deleteOwnComment(c.id);
    if (!r.ok) setError(r.error ?? "Could not delete.");
    await load();
    setBusy(false);
  };

  const remaining = MAX_COMMENT - body.length;

  return (
    <section className="mx-auto max-w-3xl">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-forest sm:text-2xl">
        <MessageSquare className="h-5 w-5" />
        {comments.length > 0
          ? `${comments.length} comment${comments.length === 1 ? "" : "s"}`
          : "Comments"}
      </h2>

      {/* ---- Composer ---- */}
      {user ? (
        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Replying to <strong className="text-forest">{replyTo.author_name}</strong>
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="font-medium text-forest hover:text-gold"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <UserAvatar
                email={user.email}
                name={user.name}
                src={user.avatar}
                className="h-9 w-9 shrink-0"
              />
            <div className="min-w-0 flex-1">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_COMMENT))}
                rows={3}
                placeholder="Share your experience or ask a question…"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-xs",
                    remaining < 100 ? "text-gold-700" : "text-muted-foreground"
                  )}
                >
                  {remaining < 200 ? `${remaining} characters left` : ""}
                </span>
                <button
                  onClick={submit}
                  disabled={busy || body.trim().length < 2}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {replyTo ? "Reply" : "Post comment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Not a wall — the comments below are still readable. Signing in is
           only needed to add one. */
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
          <Link href="/signin" className="font-semibold text-forest hover:text-gold">
            Sign in
          </Link>{" "}
          to join the conversation. You can read every comment without an account.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* ---- Thread ---- */}
      <div className="mt-6">
        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
          </p>
        ) : roots.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No comments yet. Be the first.
          </p>
        ) : (
          <ul className="space-y-5">
            {roots.map((c) => (
              <li key={c.id}>
                <CommentRow
                  comment={c}
                  isMine={uid != null && c.user_id === uid}
                  onReply={() => setReplyTo(c)}
                  onDelete={() => remove(c)}
                  canReply={Boolean(user)}
                  busy={busy}
                />
                {repliesOf(c.id).length > 0 && (
                  <ul className="mt-4 space-y-4 border-l-2 border-border pl-4 sm:pl-6">
                    {repliesOf(c.id).map((r) => (
                      <li key={r.id}>
                        <CommentRow
                          comment={r}
                          isMine={uid != null && r.user_id === uid}
                          onReply={() => setReplyTo(r)}
                          onDelete={() => remove(r)}
                          canReply={Boolean(user)}
                          busy={busy}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CommentRow({
  comment,
  isMine,
  canReply,
  busy,
  onReply,
  onDelete,
}: {
  comment: BlogComment;
  isMine: boolean;
  canReply: boolean;
  busy: boolean;
  onReply: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = React.useState(false);

  return (
    <div className="flex gap-3">
      {/* Seeded with the user id, not an email. The avatar colour stays
          consistent per commenter without publishing a contact address —
          we deliberately never store the commenter's email on the comment. */}
      <UserAvatar
        email={comment.user_id}
        name={comment.author_name}
        src={comment.author_avatar ?? undefined}
        className="h-9 w-9 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-forest">{comment.author_name}</span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(comment.created_at)}
          </span>
        </div>

        {/* Plain text, rendered as text. Comments are not markdown — an
            unmoderated field that renders links is a spam invitation. */}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
          {comment.body}
        </p>

        <div className="mt-1.5 flex items-center gap-3 text-xs">
          {canReply && (
            <button
              onClick={onReply}
              className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-forest"
            >
              <Reply className="h-3 w-3" /> Reply
            </button>
          )}
          {isMine &&
            (confirming ? (
              <>
                <button
                  onClick={onDelete}
                  disabled={busy}
                  className="font-semibold text-red-600 hover:text-red-700 disabled:opacity-60"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-muted-foreground hover:text-forest"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
