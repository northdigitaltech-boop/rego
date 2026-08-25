import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Blog comments and likes.
 *
 * Written directly by signed-in users through RLS, not via an
 * admin API route. The policies do the enforcing:
 *
 *   with check (user_id = auth.uid())
 *
 * That is what makes posting as somebody else impossible no
 * matter how the request is built — a check in this file would
 * only stop the app's own form.
 * ============================================================ */

export interface BlogComment {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  body: string;
  parent_id: string | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface Engagement {
  likes: number;
  comments: number;
  likedByMe: boolean;
}

/* ------------------------------------------------------------------ */
/* Counts                                                              */
/* ------------------------------------------------------------------ */

export async function getEngagement(postId: string): Promise<Engagement> {
  const empty = { likes: 0, comments: 0, likedByMe: false };
  if (!isSupabaseConfigured || !postId) return empty;
  try {
    const { data, error } = await supabase.rpc("blog_post_engagement", {
      p_post_id: postId,
    });
    if (error || !Array.isArray(data) || data.length === 0) return empty;
    const r = data[0] as { likes: number; comments: number; liked_by_me: boolean };
    return {
      likes: Number(r.likes) || 0,
      comments: Number(r.comments) || 0,
      likedByMe: Boolean(r.liked_by_me),
    };
  } catch {
    return empty;
  }
}

/* ------------------------------------------------------------------ */
/* Likes                                                               */
/* ------------------------------------------------------------------ */

export interface EngageResult {
  ok: boolean;
  error?: string;
}

/**
 * Toggle a like.
 *
 * The unique key on (post_id, user_id) means a duplicate insert is a
 * constraint violation rather than a second like — so a double-click or a
 * replayed request cannot inflate the count. That error is treated as
 * "already liked", which is the truth.
 */
export async function toggleLike(
  postId: string,
  liked: boolean
): Promise<EngageResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not available." };

  const { data: sess } = await supabase.auth.getUser();
  const uid = sess?.user?.id;
  if (!uid) return { ok: false, error: "Sign in to like this article." };

  try {
    if (liked) {
      const { error } = await supabase
        .from("blog_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", uid);
      if (error) return { ok: false, error: "Could not remove your like." };
      return { ok: true };
    }

    const { error } = await supabase
      .from("blog_likes")
      .insert({ post_id: postId, user_id: uid });

    // 23505 = already liked. Not an error from the reader's point of view.
    if (error && error.code !== "23505") {
      return { ok: false, error: "Could not save your like." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

export async function getComments(postId: string): Promise<BlogComment[]> {
  if (!isSupabaseConfigured || !postId) return [];
  try {
    const { data } = await supabase
      .from("blog_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(300);
    return (data as BlogComment[]) ?? [];
  } catch {
    return [];
  }
}

const MAX_COMMENT = 2000;

export async function addComment(input: {
  postId: string;
  body: string;
  parentId?: string | null;
  authorName: string;
  authorAvatar?: string | null;
}): Promise<EngageResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not available." };

  const body = input.body.trim();
  if (body.length < 2) return { ok: false, error: "Write something first." };
  if (body.length > MAX_COMMENT) {
    return { ok: false, error: `Keep it under ${MAX_COMMENT} characters.` };
  }

  const { data: sess } = await supabase.auth.getUser();
  const uid = sess?.user?.id;
  if (!uid) return { ok: false, error: "Sign in to comment." };

  try {
    const { error } = await supabase.from("blog_comments").insert({
      post_id: input.postId,
      user_id: uid,
      author_name: input.authorName.trim().slice(0, 80) || "Traveller",
      author_avatar: input.authorAvatar || null,
      body,
      parent_id: input.parentId ?? null,
    });

    if (error) {
      /* The database rate limit raises a check_violation with a message
         written for a reader — pass it through rather than replacing it with
         something vaguer. */
      if (/too many comments/i.test(error.message)) {
        return { ok: false, error: error.message };
      }
      return { ok: false, error: "Could not post your comment." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

/** Delete your own comment. RLS refuses anyone else's. */
export async function deleteOwnComment(id: string): Promise<EngageResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not available." };
  try {
    const { error } = await supabase.from("blog_comments").delete().eq("id", id);
    if (error) return { ok: false, error: "Could not delete." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

/** "3 hours ago". Absolute dates are noise on a comment thread. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
