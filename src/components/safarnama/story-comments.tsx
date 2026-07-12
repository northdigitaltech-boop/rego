"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Send, MessageCircle } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import {
  getStoryComments,
  addComment,
  type StoryCommentRow,
} from "@/lib/safarnama";
import { photo } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function StoryComments({ storyId }: { storyId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = React.useState<StoryCommentRow[]>([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setComments(await getStoryComments(storyId));
    setLoading(false);
  }, [storyId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setBusy(true);
    await addComment({
      story_id: storyId,
      user_email: user.email,
      user_name: user.name,
      user_avatar: user.avatar ?? null,
      text: text.trim(),
    });
    setText("");
    setBusy(false);
    await load();
  };

  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-forest">
        <MessageCircle className="h-5 w-5 text-forest-600" /> Comments ({comments.length})
      </h2>

      {user ? (
        <form onSubmit={submit} className="mt-4 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo(user.avatar || "https://i.pravatar.cc/80?u=" + user.email)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          <div className="flex-1">
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share your thoughts…"
              className="auth-input resize-none"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-gradient-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post comment
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Link href={`/signin?redirect=/safarnama/${storyId}`} className="font-semibold text-forest-600 underline">
            Sign in
          </Link>{" "}
          to leave a comment.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-forest-600" />
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo(c.user_avatar || "https://i.pravatar.cc/80?u=" + c.user_email)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              <div className="flex-1 rounded-2xl border border-border/70 bg-card px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-forest">{c.user_name || "Traveller"}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
