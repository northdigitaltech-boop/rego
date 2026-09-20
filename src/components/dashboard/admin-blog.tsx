"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";

import { ImageUpload } from "@/components/ui/image-upload";
import { StoryMarkdown } from "@/components/safarnama/story-markdown";
import {
  BLOG_CATEGORIES,
  CATEGORY_LABEL,
  deletePost,
  formatPostDate,
  getAllPostsForAdmin,
  readingTime,
  savePost,
  setPostStatus,
  slugifyTitle,
  type BlogPost,
  type BlogStatus,
} from "@/lib/blog";
import { AdminBlogComments } from "@/components/dashboard/admin-blog-comments";
import { cn } from "@/lib/utils";

/* ============================================================
 * Blog & News — admin.
 *
 * ---------------------------------------------------------------------------
 * THE EDITOR IS MARKDOWN WITH A LIVE PREVIEW, NOT A WYSIWYG.
 *
 * A rich-text editor stores HTML, and HTML from an editor has to be either
 * trusted or sanitised on every render. Markdown rendered by StoryMarkdown
 * builds React elements and never parses HTML — the guarantee is structural
 * rather than a filter that can be bypassed.
 *
 * The preview beside the textarea gives the same "see what you're writing"
 * benefit without the dependency or the attack surface.
 * ---------------------------------------------------------------------------
 */

const STATUS_STYLES: Record<BlogStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-gold/20 text-gold-700",
  published: "bg-forest-50 text-forest-600",
};

const EMPTY = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  featured_image_url: "",
  image_alt: "",
  category: "rego-updates",
  tags: "",
  author_name: "",
  is_featured: false,
  scheduled_at: "",
  seo_title: "",
  meta_description: "",
  canonical_url: "",
  og_title: "",
  og_description: "",
  og_image_url: "",
};

type Draft = typeof EMPTY;

export function AdminBlog() {
  const [posts, setPosts] = React.useState<BlogPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>({ ...EMPTY });
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<BlogPost | null>(null);

  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | BlogStatus>("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    setPosts(await getAllPostsForAdmin());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const visible = posts.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.slug.includes(q) ||
      (p.excerpt ?? "").toLowerCase().includes(q)
    );
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };

  const onTitle = (v: string) => {
    set("title", v);
    // Stops following once the slug is edited by hand — a deliberate slug
    // must not be overwritten by a later typo in the title.
    if (!slugTouched && !editing) set("slug", slugifyTitle(v));
  };

  const reset = () => {
    setDraft({ ...EMPTY });
    setEditing(null);
    setCreating(false);
    setSlugTouched(false);
    setError("");
    setSaved(false);
    setPreview(false);
  };

  const openPost = (p: BlogPost) => {
    setEditing(p.id);
    setCreating(true);
    setSlugTouched(true);
    setError("");
    setSaved(false);
    setDraft({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? "",
      content: p.content,
      featured_image_url: p.featured_image_url ?? "",
      image_alt: p.image_alt ?? "",
      category: p.category,
      tags: (p.tags ?? []).join(", "),
      author_name: p.author_name ?? "",
      is_featured: p.is_featured,
      scheduled_at: p.scheduled_at ? p.scheduled_at.slice(0, 16) : "",
      seo_title: p.seo_title ?? "",
      meta_description: p.meta_description ?? "",
      canonical_url: p.canonical_url ?? "",
      og_title: p.og_title ?? "",
      og_description: p.og_description ?? "",
      og_image_url: p.og_image_url ?? "",
    });
  };

  const save = async () => {
    setBusy(true);
    setError("");
    const r = await savePost(editing, {
      ...draft,
      tags: draft.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      scheduled_at: draft.scheduled_at || null,
    } as never);
    if (!r.ok) setError(r.error || "Could not save.");
    else {
      setSaved(true);
      setEditing(r.id ?? editing);
      await load();
    }
    setBusy(false);
  };

  const changeStatus = async (id: string, status: BlogStatus) => {
    setBusy(true);
    setError("");
    const r = await setPostStatus(id, status);
    if (!r.ok) setError(r.error || "Could not change status.");
    await load();
    setBusy(false);
  };

  const remove = async (p: BlogPost) => {
    setBusy(true);
    setError("");
    const r = await deletePost(p.id);
    if (!r.ok) setError(r.error || "Could not delete.");
    setConfirmDelete(null);
    if (editing === p.id) reset();
    await load();
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      {/* ---- Toolbar ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            reset();
            setCreating(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700"
        >
          <Plus className="h-4 w-4" /> New post
        </button>

        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm"
          />
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | BlogStatus)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
        </select>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* ---- List ---- */}
      {loading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading posts…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {posts.length === 0 ? "No posts yet." : "No posts match."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {visible.map((p) => (
            <li key={p.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  onClick={() => openPost(p)}
                  className="min-w-0 flex-1 text-left font-semibold text-forest hover:text-gold"
                >
                  {p.is_featured && (
                    <Star className="mr-1 inline h-3.5 w-3.5 fill-gold text-gold" />
                  )}
                  {p.title}
                </button>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    STATUS_STYLES[p.status]
                  )}
                >
                  {p.status}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{CATEGORY_LABEL[p.category] ?? p.category}</span>
                <span>/{p.slug}</span>
                <span>{readingTime(p.content)} min</span>
                {p.status === "published" && p.published_at && (
                  <span>Published {formatPostDate(p.published_at)}</span>
                )}
                {p.status === "scheduled" && p.scheduled_at && (
                  <span className="font-medium text-gold-700">
                    Goes live {formatPostDate(p.scheduled_at)}
                  </span>
                )}

                <span className="ml-auto flex flex-wrap items-center gap-2">
                  {p.status === "published" && (
                    <Link
                      href={`/blog-news/${p.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 font-medium text-forest hover:text-gold"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Link>
                  )}
                  {p.status !== "published" ? (
                    <button
                      disabled={busy}
                      onClick={() => changeStatus(p.id, "published")}
                      className="font-semibold text-forest hover:text-gold disabled:opacity-60"
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => changeStatus(p.id, "draft")}
                      className="font-semibold text-forest hover:text-gold disabled:opacity-60"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => setConfirmDelete(p)}
                    className="text-muted-foreground hover:text-red-600 disabled:opacity-60"
                    aria-label={`Delete ${p.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ---- Editor ---- */}
      {creating && (
        <div className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-display text-base font-bold text-forest">
              {editing ? "Edit post" : "New post"}
            </h4>
            <button
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-forest"
            >
              Close
            </button>
          </div>

          <div className="space-y-3">
            <Field label="Title">
              <input
                value={draft.title}
                onChange={(e) => onTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </Field>

            <Field
              label="Slug"
              hint="Part of the public URL. Changing it after publishing breaks existing links — add a redirect if you must."
            >
              {/* Typed slugs went in raw, so a capital letter, a space or an
                  apostrophe produced a value the database CHECK rejects —
                  and the save failed with nothing on screen explaining why.
                  Normalising here means what is typed is what gets stored.
                  The trailing hyphen is kept WHILE typing (stripping it makes
                  "two-part" impossible to type) and trimmed on blur. */}
              <input
                value={draft.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set(
                    "slug",
                    e.target.value
                      .toLowerCase()
                      .replace(/['’]/g, "")
                      .replace(/[^a-z0-9-]+/g, "-")
                      .replace(/-{2,}/g, "-")
                      .replace(/^-+/, "")
                      .slice(0, 90)
                  );
                }}
                onBlur={() => set("slug", slugifyTitle(draft.slug))}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category">
                <select
                  value={draft.category}
                  onChange={(e) => set("category", e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  {BLOG_CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Author" hint="Leave blank to use your name.">
                <input
                  value={draft.author_name}
                  onChange={(e) => set("author_name", e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Excerpt" hint="Shown on the cards and used as the fallback meta description.">
              <textarea
                value={draft.excerpt}
                onChange={(e) => set("excerpt", e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed"
              />
            </Field>

            {/* ---- Content + preview ---- */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Article
                </label>
                <button
                  onClick={() => setPreview((v) => !v)}
                  className="text-xs font-medium text-forest hover:text-gold"
                >
                  {preview ? "Edit" : "Preview"}
                </button>
              </div>

              {preview ? (
                <div className="min-h-[240px] rounded-lg border border-border bg-card p-4">
                  {draft.content.trim() ? (
                    <StoryMarkdown text={draft.content} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                  )}
                </div>
              ) : (
                <textarea
                  value={draft.content}
                  onChange={(e) => set("content", e.target.value)}
                  rows={14}
                  placeholder={"## A heading\n\nA paragraph.\n\n- A list item\n\n[A link](https://example.com)"}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm leading-relaxed"
                />
              )}
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Markdown: <code>##</code> headings, <code>**bold**</code>,{" "}
                <code>*italic*</code>, <code>-</code> lists, <code>&gt;</code> quotes,{" "}
                <code>[text](url)</code>, <code>![alt](image)</code>.{" "}
                {readingTime(draft.content)} min read.
              </p>
            </div>

            {/* ---- Image ---- */}
            <Field label="Featured image">
              <ImageUpload folder="blog"
                value={draft.featured_image_url}
                onChange={(url) => set("featured_image_url", url)}
              />
            </Field>
            <Field
              label="Image alt text"
              hint="Describe the photo for screen readers and image search. Not a keyword slot."
            >
              <input
                value={draft.image_alt}
                onChange={(e) => set("image_alt", e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Tags" hint="Comma separated.">
              <input
                value={draft.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="skardu, winter, road trip"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Schedule publication"
                hint="Goes live automatically at this time."
              >
                <input
                  type="datetime-local"
                  value={draft.scheduled_at}
                  onChange={(e) => set("scheduled_at", e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </Field>
              <label className="flex items-start gap-2 self-end rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  checked={draft.is_featured}
                  onChange={(e) => set("is_featured", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-forest-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-forest">Featured</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Shown large at the top of Blog &amp; News.
                  </span>
                </span>
              </label>
            </div>

            {/* ---- SEO ---- */}
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-semibold text-forest">
                SEO &amp; social
              </summary>
              <div className="mt-3 space-y-3">
                <Field label="SEO title" hint="Falls back to the post title.">
                  <input
                    value={draft.seo_title}
                    onChange={(e) => set("seo_title", e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Meta description" hint="Falls back to the excerpt.">
                  <textarea
                    value={draft.meta_description}
                    onChange={(e) => set("meta_description", e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                </Field>
                <Field
                  label="Canonical URL"
                  hint="Leave blank unless this article is deliberately a copy of another page. Must be a path on this site."
                >
                  <input
                    value={draft.canonical_url}
                    onChange={(e) => set("canonical_url", e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Open Graph title">
                  <input
                    value={draft.og_title}
                    onChange={(e) => set("og_title", e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Open Graph description">
                  <textarea
                    value={draft.og_description}
                    onChange={(e) => set("og_description", e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Open Graph image" hint="Falls back to the featured image.">
                  <ImageUpload folder="blog"
                    value={draft.og_image_url}
                    onChange={(url) => set("og_image_url", url)}
                  />
                </Field>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={save}
                disabled={busy || !draft.title.trim() || !draft.content.trim() || !draft.slug.trim()}
                className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
              >
                {busy ? "Saving…" : editing ? "Save changes" : "Save as draft"}
              </button>

              {editing && (
                <>
                  <button
                    onClick={() => changeStatus(editing, "published")}
                    disabled={busy}
                    className="rounded-lg border border-forest-600 px-4 py-2 text-sm font-semibold text-forest hover:bg-forest-50 disabled:opacity-60"
                  >
                    Publish
                  </button>
                  {draft.scheduled_at && (
                    <button
                      onClick={() => changeStatus(editing, "scheduled")}
                      disabled={busy}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-forest hover:bg-muted disabled:opacity-60"
                    >
                      Schedule
                    </button>
                  )}
                </>
              )}

              {saved && (
                <span className="flex items-center gap-1 text-sm font-medium text-forest-600">
                  <CheckCircle2 className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- Comment moderation ---- */}
      {!creating && (
        <div className="rounded-xl border border-border p-4">
          <AdminBlogComments />
        </div>
      )}

      {/* ---- Delete confirmation ---- */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
            <h4 className="font-display text-lg font-bold text-forest">
              Delete “{confirmDelete.title}”?
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This cannot be undone. If the post has been published, anyone
              holding the link will get a 404 — unpublishing instead keeps the
              article for later.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => remove(confirmDelete)}
                disabled={busy}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
