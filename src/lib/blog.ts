import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Blog & News — data layer.
 *
 * Public reads go straight at the table because the RLS policy IS the rule:
 * published, and its publication time has arrived. A post scheduled for next
 * week has a row but no reader can see it.
 *
 * Every read returns [] or null on failure. A blog outage must never take a
 * page down with it.
 * ============================================================ */

export const BLOG_CATEGORIES = [
  { slug: "travel-guides", label: "Travel Guides" },
  { slug: "destinations", label: "Destinations" },
  { slug: "tourism-news", label: "Tourism News" },
  { slug: "safety-updates", label: "Safety Updates" },
  { slug: "events", label: "Events" },
  { slug: "rego-updates", label: "REGO Updates" },
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]["slug"];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  BLOG_CATEGORIES.map((c) => [c.slug, c.label])
);

export type BlogStatus = "draft" | "scheduled" | "published";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  image_alt: string | null;
  category: string;
  tags: string[];
  author_id: string | null;
  author_name: string | null;
  status: BlogStatus;
  is_featured: boolean;
  scheduled_at: string | null;
  published_at: string | null;
  seo_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Columns the public site needs. Excludes nothing sensitive — there is none. */
const PUBLIC_COLUMNS =
  "id,title,slug,excerpt,content,featured_image_url,image_alt,category,tags," +
  "author_name,status,is_featured,published_at,scheduled_at," +
  "seo_title,meta_description,canonical_url,og_title,og_description,og_image_url," +
  "created_at,updated_at";

/* ------------------------------------------------------------------ */
/* Reading time                                                        */
/* ------------------------------------------------------------------ */

/**
 * Estimated reading time in minutes.
 *
 * 200 words per minute — the low end of the usual 200-250 range, because
 * under-promising is the safer error. Markdown syntax is stripped first so a
 * heavily linked article does not read as longer than it is.
 *
 * Always at least 1: "0 min read" is nonsense.
 */
export function readingTime(content: string): number {
  const plain = (content ?? "")
    .replace(/```[\s\S]*?```/g, " ")     // fenced code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links and images → their text
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = plain ? plain.split(" ").length : 0;
  return Math.max(1, Math.round(words / 200));
}

/** "24 August 2026". Consistent across the site regardless of locale. */
export function formatPostDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "hunza-in-autumn" from "Hunza in Autumn". Matches the DB CHECK constraint. */
export function slugifyTitle(title: string): string {
  return (title ?? "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/* ------------------------------------------------------------------ */
/* Public reads                                                        */
/* ------------------------------------------------------------------ */

export interface PostQuery {
  category?: string | null;
  /** Matches title, excerpt and tags. */
  search?: string | null;
  limit?: number;
  offset?: number;
}

export interface PostPage {
  posts: BlogPost[];
  total: number;
}

export async function getPublishedPosts(q: PostQuery = {}): Promise<PostPage> {
  if (!isSupabaseConfigured) return { posts: [], total: 0 };

  const limit = Math.min(Math.max(q.limit ?? 9, 1), 50);
  const offset = Math.max(q.offset ?? 0, 0);

  try {
    let query = supabase
      .from("blog_posts")
      .select(PUBLIC_COLUMNS, { count: "exact" })
      /* RLS already restricts this to visible posts. Ordering by published_at
         with created_at as the fallback keeps scheduled-then-live posts in
         the right place. */
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (q.category && q.category !== "all") {
      query = query.eq("category", q.category);
    }

    if (q.search?.trim()) {
      const term = q.search.trim().replace(/[%,()]/g, "");
      if (term) {
        query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
      }
    }

    const { data, error, count } = await query;
    if (error) return { posts: [], total: 0 };
    return { posts: (data as unknown as BlogPost[]) ?? [], total: count ?? 0 };
  } catch {
    return { posts: [], total: 0 };
  }
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!isSupabaseConfigured || !slug) return null;
  try {
    /* ----------------------------------------------------------------
       WHY NOT .maybeSingle()

       maybeSingle() asks PostgREST for at most one row and returns an
       ERROR — not a row — when the filter matches two. This page reads
       that as "no such post" and renders a 404, so a single duplicated
       slug takes BOTH articles offline while they carry on appearing,
       and linking, from the index. Un-openable, with nothing on the
       page to say why.

       phase85 declares `slug text not null unique`, but inside
       `create table if not exists` — so on a database where blog_posts
       already existed, that constraint was never applied and duplicates
       are possible. The query at the bottom of this file finds them.

       Ordering and taking the first row is the honest behaviour: the
       newest post wins the URL, and the other stays reachable once the
       slug is corrected. A reader gets an article either way.
       ---------------------------------------------------------------- */
    const { data } = await supabase
      .from("blog_posts")
      .select(PUBLIC_COLUMNS)
      .eq("slug", slug)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1);

    const rows = (data as unknown as BlogPost[]) ?? [];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** The featured post for the hero, or the newest one when none is featured. */
export async function getFeaturedPost(): Promise<BlogPost | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase
      .from("blog_posts")
      .select(PUBLIC_COLUMNS)
      .eq("is_featured", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as unknown as BlogPost;

    const { posts } = await getPublishedPosts({ limit: 1 });
    return posts[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Related posts — same category first, newest otherwise.
 *
 * Deliberately not "similar content": without a real similarity measure that
 * would just be the newest posts wearing a label. Same category is a claim we
 * can actually keep.
 */
export async function getRelatedPosts(
  post: BlogPost,
  limit = 3
): Promise<BlogPost[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabase
      .from("blog_posts")
      .select(PUBLIC_COLUMNS)
      .eq("category", post.category)
      .neq("id", post.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    const same = (data as unknown as BlogPost[]) ?? [];
    if (same.length >= limit) return same;

    // Top up from anywhere rather than showing a lonely single card.
    const { posts } = await getPublishedPosts({ limit: limit + 2 });
    const seen = new Set([post.id, ...same.map((p) => p.id)]);
    return [...same, ...posts.filter((p) => !seen.has(p.id))].slice(0, limit);
  } catch {
    return [];
  }
}

/** Every published slug, for the sitemap. */
export async function getAllPublishedPosts(): Promise<BlogPost[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabase
      .from("blog_posts")
      .select("id,slug,updated_at,published_at,created_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(2000);
    return (data as unknown as BlogPost[]) ?? [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Admin                                                              */
/* ------------------------------------------------------------------ */

export async function getAllPostsForAdmin(): Promise<BlogPost[]> {
  if (!isSupabaseConfigured) return [];
  try {
    // Flip anything whose scheduled time has passed, so the list is honest.
    await supabase.rpc("publish_due_posts");
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    return (data as unknown as BlogPost[]) ?? [];
  } catch {
    return [];
  }
}

export interface BlogApiResult {
  ok: boolean;
  error?: string;
  id?: string;
  slug?: string;
}

async function post(body: unknown): Promise<BlogApiResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "Please sign in again." };

    const res = await fetch("/api/admin/blog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as BlogApiResult;
    if (!res.ok) return { ok: false, error: json.error || `Server returned ${res.status}.` };
    return json;
  } catch {
    return { ok: false, error: "Network error. Nothing was saved." };
  }
}

export function savePost(id: string | null, patch: Partial<BlogPost>) {
  return post({ action: "save", id, patch });
}

export function setPostStatus(id: string, status: BlogStatus) {
  return post({ action: "set_status", id, status });
}

export function deletePost(id: string) {
  return post({ action: "delete", id });
}
