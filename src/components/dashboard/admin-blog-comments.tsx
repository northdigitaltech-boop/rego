"use client";

import * as React from "react";
import Link from "next/link";
import { EyeOff, Eye, Loader2, Trash2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { timeAgo, type BlogComment } from "@/lib/blog-engagement";
import { cn } from "@/lib/utils";

/* ============================================================
 * Comment moderation.
 *
 * HIDE is the default action, not delete. A moderation decision
 * is usually made quickly; keeping the row means a mistake is
 * reversible and a pattern of abuse is still reviewable.
 * Deleting is available but separate.
 *
 * Admins see hidden comments here — the RLS admin-read policy
 * is what makes that possible, while the public policy filters
 * them out for everyone else.
 * ============================================================ */

type Row = BlogComment & { blog_posts?: { title: string; slug: string } | null };

async function post(body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Sign in again." };
  const res = await fetch("/api/admin/blog", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
}

export function AdminBlogComments() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showHidden, setShowHidden] = React.useState(false);
  const [confirm, setConfirm] = React.useState<Row | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("blog_comments")
      .select("*, blog_posts(title, slug)")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const visible = rows.filter((r) => (showHidden ? true : !r.is_hidden));
  const hiddenCount = rows.filter((r) => r.is_hidden).length;

  const act = async (r: Row, op: "hide" | "unhide" | "delete") => {
    setBusy(true);
    setError("");
    const res = await post({ action: "moderate_comment", id: r.id, op });
    if (!res.ok) setError(res.error ?? "Could not update.");
    setConfirm(null);
    await load();
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="font-display text-base font-bold text-forest">Comments</h4>
        {hiddenCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="h-4 w-4 accent-forest-600"
            />
            Show {hiddenCount} hidden
          </label>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
          No comments yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {visible.map((r) => (
            <li key={r.id} className={cn("p-3", r.is_hidden && "bg-muted/40")}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-semibold text-forest">{r.author_name}</span>
                <span className="text-xs text-muted-foreground">
                  {timeAgo(r.created_at)}
                </span>
                {r.is_hidden && (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">
                    Hidden
                  </span>
                )}
                {r.blog_posts?.slug && (
                  <Link
                    href={`/blog-news/${r.blog_posts.slug}`}
                    target="_blank"
                    className="text-xs text-muted-foreground underline hover:text-forest"
                  >
                    {r.blog_posts.title}
                  </Link>
                )}
              </div>

              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {r.body}
              </p>

              <div className="mt-2 flex items-center gap-3 text-xs">
                {r.is_hidden ? (
                  <button
                    disabled={busy}
                    onClick={() => act(r, "unhide")}
                    className="inline-flex items-center gap-1 font-medium text-forest hover:text-gold disabled:opacity-60"
                  >
                    <Eye className="h-3.5 w-3.5" /> Show again
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => act(r, "hide")}
                    className="inline-flex items-center gap-1 font-medium text-forest hover:text-gold disabled:opacity-60"
                  >
                    <EyeOff className="h-3.5 w-3.5" /> Hide
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => setConfirm(r)}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-red-600 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
            <h4 className="font-display text-lg font-bold text-forest">
              Delete this comment permanently?
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Hiding it instead keeps the record, which is usually what you want —
              a hidden comment can be restored and still shows a pattern if the
              same person does it again.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => act(confirm, "hide")}
                disabled={busy}
                className="rounded-lg border border-forest-600 px-3 py-2 text-sm font-semibold text-forest hover:bg-forest-50 disabled:opacity-60"
              >
                Hide instead
              </button>
              <button
                onClick={() => act(confirm, "delete")}
                disabled={busy}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
