import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";
import { validateAnswer, canPublish, type SourceRef } from "@/lib/answers";

/* ============================================================
 * Answer management — the only write path.
 *
 * Publishing an answer puts a factual claim on a public page in
 * Rego's name. So every request is IP-checked, same-origin,
 * rate limited, authenticated, verified admin by reading
 * profiles server-side, validated field by field, and audited.
 *
 * THE VALIDATION RUNS HERE, NOT ONLY IN THE FORM.
 * The admin screen shows warnings as you type, which is a
 * convenience. This route re-runs the same rules, because the
 * form is not the only way a request reaches this endpoint.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY — server-only, never
 * NEXT_PUBLIC. This repo is public.
 * ============================================================ */

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const EDITABLE = new Set([
  "question",
  "short_answer",
  "detailed_answer",
  "answer_type",
  "intent",
  "entity_type",
  "entity_id",
  "market_id",
  "location_id",
  "service_slug",
  "language_code",
  "source_references",
  "is_time_sensitive",
  "valid_from",
  "valid_until",
  "last_verified_at",
  "display_order",
  "is_featured",
]);

/* `status` is NOT editable through the generic save path. It only changes
   through the explicit transition actions below, so every publish is a
   deliberate act with its own audit row. */
const TRANSITIONS: Record<string, string> = {
  submit: "review",
  publish: "published",
  unpublish: "draft",
  archive: "archived",
  needs_review: "needs_review",
};

const MAX_TEXT = 8000;

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

/** Reject anything that is not a real http(s) URL we would show a reader. */
function cleanSources(v: unknown): SourceRef[] | string {
  if (!Array.isArray(v)) return "Sources must be a list.";
  if (v.length > 10) return "At most 10 sources.";
  const out: SourceRef[] = [];
  for (const raw of v as { label?: unknown; url?: unknown }[]) {
    const url = String(raw?.url ?? "").trim();
    if (!url) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return `"${url}" is not a valid URL.`;
    }
    /* javascript: and data: URLs in a link a reader clicks. */
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `"${url}" must be http or https.`;
    }
    out.push({
      label: String(raw?.label ?? "").trim().slice(0, 200) || parsed.hostname,
      url: parsed.toString(),
    });
  }
  return out;
}

export async function POST(req: Request) {
  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;
  if (!sameOrigin(req)) return bad("Forbidden", 403);
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad("Answer management is not configured on this server.", 500);
  }

  const ip = clientIp(req);
  const limited = limitAndLog(req, `answers-admin:${ip}`, 40, 60_000, {
    endpoint: "/api/admin/answers",
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
    .select("role, email")
    .eq("id", caller.user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role !== "admin") {
    return bad("Admins only.", 403);
  }
  const actorEmail =
    (profile as { email?: string } | null)?.email ?? caller.user.email ?? null;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Malformed request.");
  }

  const action = String(body.action ?? "");
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const audit = async (e: {
    answerId?: string | null;
    action: string;
    before?: unknown;
    after?: unknown;
  }) => {
    try {
      await sb.from("answer_audit_logs").insert({
        answer_id: e.answerId ?? null,
        actor_id: caller.user.id,
        actor_email: actorEmail,
        action: e.action,
        before_value: e.before ?? null,
        after_value: e.after ?? null,
        request_id: requestId,
      });
    } catch {
      /* An audit failure must not roll back a change the admin already saw
         succeed. It is a gap in the log, not a reason to fail the request. */
    }
  };

  /* ---------------------------------------------------------------- */
  if (action === "save") {
    const id = body.id ? String(body.id) : null;
    const patch = (body.patch ?? {}) as Record<string, unknown>;
    const clean: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(patch)) {
      if (!EDITABLE.has(k)) return bad(`"${k}" cannot be set here.`);

      if (k === "source_references") {
        const r = cleanSources(v);
        if (typeof r === "string") return bad(r);
        clean[k] = r;
      } else if (k === "is_time_sensitive" || k === "is_featured") {
        if (typeof v !== "boolean") return bad(`${k} must be true or false.`);
        clean[k] = v;
      } else if (k === "display_order") {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 9999) return bad("Bad display order.");
        clean[k] = n;
      } else if (k.startsWith("valid_") || k === "last_verified_at") {
        if (v === null || v === "") { clean[k] = null; continue; }
        const d = new Date(String(v));
        if (Number.isNaN(d.getTime())) return bad(`${k} is not a valid date.`);
        clean[k] = d.toISOString();
      } else {
        const s = String(v ?? "").trim();
        if (s.length > MAX_TEXT) return bad(`"${k}" is too long.`);
        clean[k] = s || null;
      }
    }

    if (Object.keys(clean).length === 0) return bad("Nothing to change.");

    /* Warnings are returned to the caller but do not block a SAVE — half
       written drafts are normal. They block PUBLISH instead. */
    const warnings = validateAnswer({
      question: String(clean.question ?? ""),
      short_answer: String(clean.short_answer ?? ""),
      detailed_answer: (clean.detailed_answer as string) ?? null,
      answer_type: (clean.answer_type as string) ?? undefined,
      is_time_sensitive: Boolean(clean.is_time_sensitive),
      valid_until: (clean.valid_until as string) ?? null,
      last_verified_at: (clean.last_verified_at as string) ?? null,
      source_references: (clean.source_references as SourceRef[]) ?? [],
    });

    if (id) {
      const { data: before } = await sb.from("answers").select("*").eq("id", id).maybeSingle();
      if (!before) return bad("Answer not found.", 404);

      const { error } = await sb
        .from("answers")
        .update({ ...clean, updated_by: caller.user.id })
        .eq("id", id);
      if (error) return bad(error.message, 500);

      const subset: Record<string, unknown> = {};
      for (const k of Object.keys(clean)) subset[k] = (before as Record<string, unknown>)[k];
      await audit({ answerId: id, action: "updated", before: subset, after: clean });

      return NextResponse.json({ ok: true, id, warnings });
    }

    if (!clean.question || !clean.short_answer) {
      return bad("A question and a short answer are required.");
    }

    const { data: created, error } = await sb
      .from("answers")
      .insert({
        ...clean,
        status: "draft", // never anything else on create
        created_by: caller.user.id,
        updated_by: caller.user.id,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return bad("An answer to this question already exists for this page and language.");
      }
      return bad(error.message, 500);
    }

    await audit({ answerId: created.id, action: "created", after: clean });
    return NextResponse.json({ ok: true, id: created.id, warnings });
  }

  /* ---------------------------------------------------------------- */
  if (action === "transition") {
    const id = String(body.id ?? "");
    const to = String(body.to ?? "");
    if (!id) return bad("Missing answer.");
    if (!TRANSITIONS[to]) return bad("Unknown action.");

    const { data: before } = await sb.from("answers").select("*").eq("id", id).maybeSingle();
    if (!before) return bad("Answer not found.", 404);
    const row = before as Record<string, unknown>;

    /* Re-validate at the moment of publishing. Content can be saved with
       warnings and published days later; the check has to happen here, not
       only when the text was typed. */
    if (TRANSITIONS[to] === "published") {
      const warnings = validateAnswer({
        question: String(row.question ?? ""),
        short_answer: String(row.short_answer ?? ""),
        detailed_answer: (row.detailed_answer as string) ?? null,
        answer_type: (row.answer_type as string) ?? undefined,
        is_time_sensitive: Boolean(row.is_time_sensitive),
        valid_until: (row.valid_until as string) ?? null,
        last_verified_at: (row.last_verified_at as string) ?? null,
        source_references: (row.source_references as SourceRef[]) ?? [],
      });
      if (!canPublish(warnings)) {
        return NextResponse.json(
          {
            ok: false,
            error: "This answer cannot be published yet.",
            warnings: warnings.filter((w) => w.level === "block"),
          },
          { status: 422 }
        );
      }
    }

    const { error } = await sb
      .from("answers")
      .update({ status: TRANSITIONS[to], updated_by: caller.user.id })
      .eq("id", id);
    if (error) return bad(error.message, 500);

    await audit({
      answerId: id,
      action: to === "submit" ? "submitted" : to,
      before: { status: row.status },
      after: { status: TRANSITIONS[to] },
    });

    return NextResponse.json({ ok: true });
  }

  /* ---------------------------------------------------------------- */
  if (action === "expire_stale") {
    const { data, error } = await sb.rpc("expire_stale_answers");
    if (error) return bad(error.message, 500);
    if (typeof data === "number" && data > 0) {
      await audit({ action: "expired", after: { moved_to_needs_review: data } });
    }
    return NextResponse.json({ ok: true, expired: data ?? 0 });
  }

  return bad("Unknown action.");
}
