"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Heart, Bookmark, BookmarkCheck, Share2 } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { hasLiked, toggleLike } from "@/lib/safarnama";
import { cn } from "@/lib/utils";

const SAVED_KEY = "rego-safarnama-saved";

function getSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Like / Save / Share controls. `compact` for cards, full for the detail page. */
export function StoryActions({
  storyId,
  title,
  initialLikes,
  compact = false,
}: {
  storyId: string;
  title: string;
  initialLikes: number;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = React.useState(false);
  const [likes, setLikes] = React.useState(initialLikes);
  const [saved, setSaved] = React.useState(false);
  const [shareMsg, setShareMsg] = React.useState("");

  React.useEffect(() => {
    setSaved(getSaved().includes(storyId));
    if (user) hasLiked(storyId, user.email).then(setLiked);
    else setLiked(false);
  }, [user, storyId]);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onLike = async (e: React.MouseEvent) => {
    stop(e);
    if (!user) {
      router.push(`/signin?redirect=/safarnama/${storyId}`);
      return;
    }
    // optimistic
    setLiked((v) => !v);
    setLikes((n) => n + (liked ? -1 : 1));
    const now = await toggleLike(storyId, user.email);
    setLiked(now);
  };

  const onSave = (e: React.MouseEvent) => {
    stop(e);
    const cur = getSaved();
    const next = cur.includes(storyId) ? cur.filter((x) => x !== storyId) : [...cur, storyId];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(next.includes(storyId));
  };

  const onShare = async (e: React.MouseEvent) => {
    stop(e);
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/safarnama/${storyId}`
        : "";
    try {
      if (navigator.share) await navigator.share({ title: `${title} · Rego Safarnama`, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareMsg("Link copied!");
        setTimeout(() => setShareMsg(""), 2000);
      }
    } catch {
      /* cancelled */
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <button onClick={onLike} className={cn("inline-flex items-center gap-1 text-xs font-semibold", liked ? "text-red-500" : "text-muted-foreground hover:text-red-500")}>
          <Heart className={cn("h-4 w-4", liked && "fill-red-500")} /> {likes}
        </button>
        <button onClick={onSave} className={cn("ml-1 inline-flex", saved ? "text-gold" : "text-muted-foreground hover:text-gold")} aria-label="Save">
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
        <button onClick={onShare} className="inline-flex text-muted-foreground hover:text-forest-600" aria-label="Share">
          <Share2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onLike}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
          liked ? "border-red-200 bg-red-50 text-red-600" : "border-border bg-card text-forest hover:bg-muted"
        )}
      >
        <Heart className={cn("h-4 w-4", liked && "fill-red-500")} /> {likes} {likes === 1 ? "Like" : "Likes"}
      </button>
      <button
        onClick={onSave}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
          saved ? "border-gold bg-gold/10 text-gold-700" : "border-border bg-card text-forest hover:bg-muted"
        )}
      >
        {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />} {saved ? "Saved" : "Save"}
      </button>
      <button
        onClick={onShare}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-forest hover:bg-muted"
      >
        <Share2 className="h-4 w-4" /> Share Story
      </button>
      {shareMsg && <span className="text-xs font-semibold text-forest-600">{shareMsg}</span>}
    </div>
  );
}
