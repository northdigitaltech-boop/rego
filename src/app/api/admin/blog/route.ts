import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";
import { callerCanAny, isPermissionCheckConfigured } from "@/lib/staff-guard";

/* ============================================================
 * Blog & News — the only write path.
 *
 * Publishing an article puts content on a public page in Rego's
 * name, so every request is IP-checked, same-origin, rate
 * limited, authenticated, verified admin by reading profiles
 * server-side, and validated field by field.
 *
 * CONTENT IS STORED AS MARKDOWN. It is rendered by
 * components/safarnama/story-markdown.tsx, which builds React
 * elements and never parses HTML — so there is no path from an
 * article body to a script tag, and no sanitiser to be bypassed.
 * This route still rejects raw <script> and javascript: URLs, on
 * the principle that content which has no business being there
 * should not be stored either.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY — server-only, never
 * NEXT_PUBLIC. This repo is public.
 * ============================================================ */

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const EDITABLE = new Set([
  "title",
  "slug",
  "excerpt",
  "content",
  "featured_image_url",
  "image_alt",
  "category",
  "tags",
  "author_name",
  "is_featured",
  "scheduled_at",
  "seo_title",
  "meta_description",
  "canonical_url",
  "og_title",
  "og_description",
  "og_image_url",
]);

const CATEGORIES = new Set([
  "travel-guides",
  "destinations",
  "tourism-news",
  "safety-updates",
  "events",
  "rego-updates",
]);

const STATUSES = new Set(["draft", "scheduled", "published"]);

const MAX_CONTENT = 200_000; // ~40,000 words. Beyond that it is a book.
const MAX_SHORT = 500;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rego.services";

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const bad = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

/**
 * Reject content that has no legitimate place in a markdown article.
 *
 * The renderer would never execute any of it, but storing it means it sits in
 * the database waiting for the day someone renders the field somewhere else —
 * an email, an export, an admin preview built in a hurry. Refusing it now is
 * cheaper than trusting every future reader of the column.
 */
function contentIsSafe(text: string): string | null {
  if (/<\s*script\b/i.test(text)) return "Remove the <script> tag.";
  if (/<\s*iframe\b/i.test(text)) return "Remove the <iframe> tag.";
  if (/\bon(click|error|load|mouseover)\s*=/i.test(text)) {
    return "Remove the inline event handler.";
  }
  if (/javascript\s*:/i.test(text)) return "Remove the javascript: URL.";
  if (/\bdata:text\/html/i.test(text)) return "Remove the data:text/html URL.";
  return null;
}

/** Absolute http(s) URL, or a path on this site. */
function urlOk(v: string): boolean {
  if (!v) return true;
  if (v.startsWith("/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;
  if (!sameOrigin(req)) return bad("Forbidden", 403);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad("Blog management is not configured on this server.", 500);
  }

  const ip = clientIp(req);
  const limited = limitAndLog(req, `blog-admin:${ip}`, 40, 60_000, {
    endpoint: "/api/admin/blog",
    category: "admin",
  });
  if (!limited.ok) return bad("Too many changes in a short time. Wait a minute.", 429);

  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return bad("Sign in required.", 401);

  const sb = adminClient();
  const { data: caller, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !caller?.user) return bad("Session expired. Sign in again.", 401);

  const { data: profile } = await sb
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", caller.user.id)
    .maybeSingle();

  const p = profile as { role?: string; full_name?: string; email?: string } | null;
  const isAdmin = p?.role === "admin";

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Malformed request.");
  }

  const action = String(body.action ?? "");

  /* ---------------------------------------------------------------------
   * AUTHORISATION
   *
   * Was a flat "admins only". A content writer on the team now needs to
   * write, so each action asks for the permission that names it. The check
   * is per ACTION rather than per route, because "can open the blog screen"
   * and "can delete a published post" are not the same question and a route
   * that conflates them grants the wrong one.
   *
   * Deleting and comment moderation stay admin-only: phase104 has no
   * permission for either, and inventing one here would create an authority
   * the Super Admin screens never granted and nobody reviewed.
   *
   * Asked AFTER the body is parsed, because the answer depends on the
   * action. The token was already verified above; only the narrower question
   * is left.
   * ------------------------------------------------------------------- */
  if (!isAdmin) {
    const needed: Record<string, string[]> = {
      /* Creating and editing are one action here, so either permission opens
         it. The database is not fooled: a writer without edit_blog still
         cannot change somebody else's post if a policy says so. */
      save: ["create_blog", "edit_blog"],
      /* Split by what the status change actually does. Somebody trusted to
         take a post down is not automatically trusted to put one up, and
         accepting either permission for both would have made those two rows
         in staff_permissions mean the same thing. */
      set_status:
        String(body.status ?? "") === "published" ||
        String(body.status ?? "") === "scheduled"
          ? ["publish_blog"]
          : ["unpublish_blog"],
    };

    const slugs = needed[action];
    if (!slugs) return bad("Admins only.", 403);

    /* Said plainly, because the alternative is telling somebody their role is
       wrong when the truth is that this server cannot ask. */
    if (!isPermissionCheckConfigured) {
      return bad(
        "Permission checks are not configured on this server, so only admins can do this. Set NEXT_PUBLIC_SUPABASE_URL and the Supabase publishable key.",
        503
      );
    }

    const allowed = await callerCanAny(token, slugs);
    if (!allowed) {
      /* Names the permission. "Your role does not allow that" sends somebody
         to an admin who then has to guess which of thirty-nine switches was
         meant; this makes the next step obvious to both of them. The slug is
         not a secret — it is printed in the portal's own permissions list. */
      return bad(
        `Your role does not allow that. This needs ${slugs.join(" or ")} — ask an admin to add it.`,
        403
      );
    }
  }

  /* ---------------------------------------------------------------- */
  if (action === "save") {
    const id = body.id ? String(body.id) : null;
    const patch = (body.patch ?? {}) as Record<string, unknown>;
    const clean: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(patch)) {
      if (!EDITABLE.has(k)) return bad(`"${k}" cannot be set here.`);

      if (k === "is_featured") {
        if (typeof v !== "boolean") return bad("is_featured must be true or false.");
        clean[k] = v;
        continue;
      }

      if (k === "tags") {
        if (!Array.isArray(v)) return bad("Tags must be a list.");
        if (v.length > 20) return bad("At most 20 tags.");
        clean[k] = v
          .map((t) => String(t).trim().slice(0, 40))
          .filter(Boolean)
          .slice(0, 20);
        continue;
      }

      if (k === "scheduled_at") {
        if (v === null || v === "") { clean[k] = null; continue; }
        const d = new Date(String(v));
        if (Number.isNaN(d.getTime())) return bad("Scheduled date is not valid.");
        clean[k] = d.toISOString();
        continue;
      }

      if (k === "category") {
        const s = String(v ?? "");
        if (!CATEGORIES.has(s)) return bad(`Unknown category "${s}".`);
        clean[k] = s;
        continue;
      }

      if (k === "slug") {
        const s = String(v ?? "").trim().toLowerCase();
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) {
          return bad("Slug must be lowercase letters, numbers and single hyphens.");
        }
        if (s.length > 90) return bad("Slug is too long.");
        clean[k] = s;
        continue;
      }

      const s = String(v ?? "").trim();

      /* An email address in the byline is a public contact detail nobody
         chose to publish, and it is the kind of thing that gets scraped. */
      if (k === "author_name" && /\S+@\S+\.\S+/.test(s)) {
        return bad("Use a name for the author, not an email address.");
      }

      if (k === "content") {
        if (s.length > MAX_CONTENT) return bad("Article is too long.");
        const unsafe = contentIsSafe(s);
        if (unsafe) return bad(unsafe);
        clean[k] = s;
        continue;
      }

      if (k === "canonical_url" && s) {
        /* A canonical pointing at another domain hands the article away. */
        const ok =
          s.startsWith("/") ||
          (() => {
            try { return new URL(s).host === new URL(SITE_URL).host; } catch { return false; }
          })();
        if (!ok) return bad("Canonical must be a path on this site.");
      }

      if ((k === "featured_image_url" || k === "og_image_url") && s && !urlOk(s)) {
        return bad(`"${k}" must be an http(s) URL or a path.`);
      }

      if (s.length > MAX_SHORT && k !== "excerpt") {
        return bad(`"${k}" is too long.`);
      }
      if (k === "excerpt" && s.length > 1000) return bad("Excerpt is too long.");

      const unsafe = contentIsSafe(s);
      if (unsafe) return bad(`${k}: ${unsafe}`);

      clean[k] = s || null;
    }

    if (Object.keys(clean).length === 0) return bad("Nothing to change.");

    if (id) {
      const { error } = await sb
        .from("blog_posts")
        .update(clean)
        .eq("id", id);
      if (error) {
        if (error.code === "23505") return bad("Another post already uses that slug.");
        return bad(error.message, 500);
      }
      return NextResponse.json({ ok: true, id });
    }

    if (!clean.title || !clean.slug || !clean.content) {
      return bad("Title, slug and content are required.");
    }

    const { data: created, error } = await sb
      .from("blog_posts")
      .insert({
        ...clean,
        /* Always a draft on create. Publishing is a separate, deliberate
           action with its own request. */
        status: "draft",
        author_id: caller.user.id,
        /* NEVER fall back to the email address.
           author_name is printed on the public article page and emitted in
           Article JSON-LD, so an admin with no full_name set had their email
           published on every post they wrote. "Rego Team" is the correct
           fallback — a byline, not a contact address. */
        /* `p?` because the admin check that used to narrow this away is gone
           — the caller may now be staff. Which is also the right byline:
           whoever wrote it, admin or team member. */
        author_name:
          (clean.author_name as string)?.trim() ||
          p?.full_name?.trim() ||
          "Rego Team",
      })
      .select("id, slug")
      .single();

    if (error) {
      if (error.code === "23505") return bad("Another post already uses that slug.");
      return bad(error.message, 500);
    }
    return NextResponse.json({ ok: true, id: created.id, slug: created.slug });
  }

  /* ---------------------------------------------------------------- */
  if (action === "set_status") {
    const id = String(body.id ?? "");
    const status = String(body.status ?? "");
    if (!id) return bad("Missing post.");
    if (!STATUSES.has(status)) return bad("Unknown status.");

    const { data: existing } = await sb
      .from("blog_posts")
      .select("id, title, content, scheduled_at")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return bad("Post not found.", 404);

    const row = existing as { content?: string; scheduled_at?: string | null };

    if (status === "scheduled" && !row.scheduled_at) {
      return bad("Set a publication date and time before scheduling.");
    }

    /* Re-check at the moment of publishing. A post can be saved and published
       days apart, so the check has to happen here as well as on save. */
    if (status === "published") {
      const unsafe = contentIsSafe(row.content ?? "");
      if (unsafe) return bad(`Cannot publish — ${unsafe}`);
      if (!(row.content ?? "").trim()) return bad("Cannot publish an empty article.");
    }

    const { error } = await sb.from("blog_posts").update({ status }).eq("id", id);
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  /* ---------------------------------------------------------------- */
  if (action === "delete") {
    const id = String(body.id ?? "");
    if (!id) return bad("Missing post.");

    const { error } = await sb.from("blog_posts").delete().eq("id", id);
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  /* ---------------------------------------------------------------- */
  if (action === "moderate_comment") {
    const id = String(body.id ?? "");
    const op = String(body.op ?? "");
    if (!id) return bad("Missing comment.");

    /* HIDE, not delete, by default. A moderation call is a judgement made in
       a hurry; keeping the row means a mistake can be undone and a pattern of
       abuse can still be reviewed later. Deleting is a separate, explicit
       choice. */
    if (op === "hide" || op === "unhide") {
      const { error } = await sb
        .from("blog_comments")
        .update({
          is_hidden: op === "hide",
          hidden_reason:
            op === "hide" ? String(body.reason ?? "").trim().slice(0, 200) || null : null,
        })
        .eq("id", id);
      if (error) return bad(error.message, 500);
      return NextResponse.json({ ok: true });
    }

    if (op === "delete") {
      const { error } = await sb.from("blog_comments").delete().eq("id", id);
      if (error) return bad(error.message, 500);
      return NextResponse.json({ ok: true });
    }

    return bad("Unknown moderation action.");
  }

  return bad("Unknown action.");
}
