import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";

/* ============================================================
 * POST /api/admin/flight-markup
 *
 * Create, update and delete flight markup rules.
 *
 * WHY THIS IS A SERVER ROUTE AND NOT A SUPABASE WRITE
 *   These rows decide what every customer is charged. The
 *   phase117 policy already limits writes to admins, but a policy
 *   is one check — this adds the rest of the house pattern from
 *   /api/admin/markets: IP block, same-origin, rate limit, a field
 *   whitelist, and validation that catches a 200% rule before it
 *   reaches a fare.
 *
 * WHAT IS DELIBERATELY REFUSED
 *   A percentage over 100. The database has the same constraint;
 *   this exists so the admin gets a sentence instead of a
 *   Postgres error, and because a typo here is not a bad row, it
 *   is every price on the site.
 * ============================================================ */

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
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

/**
 * Is the caller an admin?
 *
 * Read from the DATABASE using the caller's own token, never from a claim in
 * the request. Fails closed: any error means no.
 */
async function callerIsAdmin(token: string): Promise<{ ok: boolean; userId: string | null }> {
  if (!SUPABASE_URL || !ANON_KEY) return { ok: false, userId: null };

  const sb: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;
  if (!user) return { ok: false, userId: null };

  const { data, error } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return { ok: false, userId: user.id };
  return { ok: (data as { role: string }).role === "admin", userId: user.id };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const SCOPES = [
  "all",
  "airline",
  "route",
  "international",
  "domestic",
  "cabin",
  "provider",
] as const;
const KINDS = ["percent", "fixed"] as const;
const CABINS = ["economy", "premium_economy", "business", "first"];

type Scope = (typeof SCOPES)[number];

/** Scopes that name a target, and what a valid target looks like. */
function validateMatchValue(scope: Scope, raw: string | null): string | null | { error: string } {
  if (scope === "all" || scope === "international" || scope === "domestic") {
    /* A target on these would be silently ignored by the engine, which is
       worse than refusing it — the admin would think it was applied. */
    return null;
  }
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return { error: "This rule needs something to match on." };

  switch (scope) {
    case "airline":
      return /^[A-Z0-9]{2}$/.test(v)
        ? v
        : { error: "Airline must be a 2-character IATA code, like PK or EK." };
    case "route":
      return /^[A-Z]{3}-[A-Z]{3}$/.test(v)
        ? v
        : { error: "Route must look like KUL-ISB — two airport codes with a hyphen." };
    case "cabin": {
      const lower = v.toLowerCase();
      return CABINS.includes(lower)
        ? lower
        : { error: `Cabin must be one of: ${CABINS.join(", ")}.` };
    }
    case "provider":
      return v.toLowerCase();
    default:
      return { error: "Unknown scope." };
  }
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;

  if (!sameOrigin(req)) return bad("Invalid origin.", 403);

  const ip = clientIp(req);
  const limited = limitAndLog(req, `flight-markup:${ip}`, 30, 60_000, {
    endpoint: "/api/admin/flight-markup",
    category: "admin",
  });
  if (!limited.ok) return bad("Too many changes in a short time. Wait a minute.", 429);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad("Server is not configured.", 503);
  }

  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return bad("Sign in required.", 401);

  const caller = await callerIsAdmin(token);
  if (!caller.ok) return bad("Admins only.", 403);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Invalid request.");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const action = String(body.action ?? "");

  /* ---------------- delete ---------------- */
  if (action === "delete") {
    const id = String(body.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return bad("Invalid rule id.");

    const { error } = await sb.from("flight_markup_rules").delete().eq("id", id);
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  /* ---------------- toggle ---------------- */
  if (action === "set_active") {
    const id = String(body.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return bad("Invalid rule id.");

    const { error } = await sb
      .from("flight_markup_rules")
      .update({ is_active: body.isActive === true })
      .eq("id", id);
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  /* ---------------- create / update ---------------- */
  if (action !== "save") return bad("Unknown action.", 400);

  const scope = String(body.scope ?? "") as Scope;
  if (!SCOPES.includes(scope)) return bad("Unknown scope.");

  const kind = String(body.kind ?? "");
  if (!KINDS.includes(kind as (typeof KINDS)[number])) return bad("Unknown markup type.");

  const matched = validateMatchValue(scope, body.matchValue as string | null);
  if (matched !== null && typeof matched === "object") return bad(matched.error);

  const value = Number(body.value);
  if (!Number.isFinite(value) || value < 0) return bad("Enter a positive amount.");

  if (kind === "percent" && value > 100) {
    return bad("A percentage markup cannot exceed 100%.");
  }

  /* Fixed amounts arrive in MAJOR units from the form — a person types 5000
     meaning PKR 5,000 — and are stored in minor units like every other
     amount in this module. Converting at the boundary means the engine and
     the database never see two conventions. */
  const storedValue = kind === "fixed" ? Math.round(value * 100) : value;
  const currency = kind === "fixed" ? String(body.currency ?? "PKR").toUpperCase() : null;

  if (kind === "fixed" && !/^[A-Z]{3}$/.test(currency ?? "")) {
    return bad("A fixed markup needs a 3-letter currency code.");
  }

  const priority = Number.isInteger(Number(body.priority)) ? Number(body.priority) : 0;
  if (priority < 0 || priority > 1000) return bad("Priority must be between 0 and 1000.");

  const row = {
    scope,
    match_value: matched,
    kind,
    value: storedValue,
    currency,
    priority,
    is_active: body.isActive !== false,
    starts_at: body.startsAt ? String(body.startsAt) : null,
    ends_at: body.endsAt ? String(body.endsAt) : null,
    label: body.label ? String(body.label).slice(0, 120) : null,
    created_by: caller.userId,
  };

  const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;

  if (id) {
    const { error } = await sb.from("flight_markup_rules").update(row).eq("id", id);
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true, id });
  }

  const { data, error } = await sb
    .from("flight_markup_rules")
    .insert(row)
    .select("id")
    .single();

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, id: data.id });
}
