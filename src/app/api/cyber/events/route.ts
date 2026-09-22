import { NextResponse } from "next/server";

import { guardCyber } from "@/lib/cyber-guard";
import { clientIp } from "@/lib/rate-limit";
import { limitAndLogShared } from "@/lib/rate-limit-guard";

/* Paginated, filtered read of security_events. Never returns everything —
 * the table is expected to grow indefinitely. */

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(req: Request) {
  /* ------------------------------------------------------------------
     60 per IP per 15 minutes, NOT the 5 used on booking and admin
     routes.

     This is a console an analyst works in: opening the security
     overview, switching a filter, clicking into an incident and back
     are each a request, and a handful of those in a minute is normal
     use, not abuse. A limit of 5 would lock the operator out of the
     tool they are using to respond to an incident — the worst possible
     moment to be rate limited by your own software.

     60 still bounds a stolen admin token to something a human could
     plausibly do, which is what the limiter is for.
     ------------------------------------------------------------------ */
  const ip = clientIp(req);
  const limited = await limitAndLogShared(req, `cyber-events:${ip}`, 60, 15 * 60_000, {
    endpoint: "/api/cyber/events",
    category: "admin",
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const guard = await guardCyber(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  const { sb } = guard;
  const url = new URL(req.url);

  const category = url.searchParams.get("category") ?? "";
  const severity = url.searchParams.get("severity") ?? "";
  const actor = (url.searchParams.get("actor") ?? "").trim().toLowerCase();
  const hours = Math.min(720, Math.max(1, Number(url.searchParams.get("hours") ?? 24)));
  const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
  const size = Math.min(MAX_PAGE_SIZE, Math.max(10, Number(url.searchParams.get("size") ?? PAGE_SIZE)));

  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  let q = sb
    .from("security_events")
    .select("*", { count: "exact" })
    .gte("detected_at", since)
    .order("detected_at", { ascending: false })
    .range(page * size, page * size + size - 1);

  if (category && category !== "all") q = q.eq("category", category);
  if (severity && severity !== "all") q = q.eq("severity", severity);
  if (actor) q = q.ilike("actor_email", `%${actor}%`);

  const { data, error, count } = await q;

  if (error) {
    return NextResponse.json({
      ok: false,
      // Distinguish "not set up" from "broken" — they need different fixes.
      error: /relation .* does not exist/i.test(error.message)
        ? "Security event table not found. Run supabase/phase68-security-events.sql."
        : "Could not load events.",
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    events: data ?? [],
    total: count ?? 0,
    page,
    size,
  });
}
