import { NextResponse } from "next/server";

import { guardCyber } from "@/lib/cyber-guard";

/* ============================================================
 * Attack-surface aggregation: IP, API, booking, database,
 * files and owner risk.
 *
 * One route rather than six, because all six answer the same
 * question — "what does security_events say about this slice?" —
 * and one guard is easier to audit than six copies of it.
 *
 * READ-ONLY. This route touches nothing outside security_events
 * and ip_reputation. It cannot block, delete, or modify anything,
 * and it never runs caller-supplied SQL.
 *
 * Every view returns `integrated: false` when its data source does
 * not exist, so the UI can say "Not integrated" instead of showing
 * a reassuring zero.
 * ============================================================ */

export const dynamic = "force-dynamic";

type View = "ip" | "api" | "booking" | "database" | "files" | "owner";

/** Which event categories feed each view. */
const VIEW_CATEGORIES: Record<View, string[]> = {
  ip: ["auth", "authz", "api", "ratelimit", "session"],
  api: ["api", "ratelimit", "authz"],
  booking: ["booking"],
  database: ["db"],
  files: ["upload"],
  owner: ["admin", "authz", "booking"],
};

/**
 * What each view still cannot see. Shown verbatim in the UI so the
 * reader always knows the shape of the blind spot.
 */
const VIEW_GAPS: Record<View, string[]> = {
  ip: [
    "Geolocation — no IP-to-country provider is wired up, so Country stays blank.",
    "Rate-limit counters live in memory per server instance, so distributed abuse can pass unrecorded.",
  ],
  api: [
    "Only routes that call limitAndLog() or logSecurityEvent() appear here. Unwired routes are invisible, not clean.",
    "No request-volume baseline — this shows denials, not total traffic.",
  ],
  booking: [
    "Booking routes are not yet instrumented. This view is wired to the store but has no writer.",
    "Payment fraud signals are out of scope — no payment provider is connected.",
  ],
  database: [
    "Supabase does not expose query logs to the application, so this shows only what the app itself records.",
    "RLS policy changes are not tracked — they happen in migrations, outside the running app.",
  ],
  files: [
    "Upload rejections are only recorded where the upload route logs them.",
    "No malware or content scanning is in place on uploaded media.",
  ],
  owner: [
    "Owner risk currently reflects recorded security events only, not listing or booking behaviour patterns.",
  ],
};

interface EventRow {
  detected_at: string;
  event_type: string;
  category: string;
  severity: string;
  risk_score: number | null;
  actor_email: string | null;
  actor_role: string | null;
  ip_address: string | null;
  endpoint: string | null;
  status: string | null;
  description: string | null;
}

interface Bucket {
  key: string;
  events: number;
  highestSeverity: string;
  topRisk: number;
  lastSeen: string;
  types: Record<string, number>;
}

const SEV_ORDER = ["info", "low", "medium", "high", "critical"];

function worse(a: string, b: string): string {
  return SEV_ORDER.indexOf(a) >= SEV_ORDER.indexOf(b) ? a : b;
}

/** Group rows by a chosen field, keeping the worst signal per group. */
function bucketBy(rows: EventRow[], pick: (r: EventRow) => string | null): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const key = pick(r);
    if (!key) continue;
    const b = map.get(key) ?? {
      key,
      events: 0,
      highestSeverity: "info",
      topRisk: 0,
      lastSeen: r.detected_at,
      types: {},
    };
    b.events += 1;
    b.highestSeverity = worse(b.highestSeverity, r.severity);
    b.topRisk = Math.max(b.topRisk, r.risk_score ?? 0);
    if (r.detected_at > b.lastSeen) b.lastSeen = r.detected_at;
    b.types[r.event_type] = (b.types[r.event_type] ?? 0) + 1;
    map.set(key, b);
  }
  return [...map.values()].sort(
    (a, b) =>
      SEV_ORDER.indexOf(b.highestSeverity) - SEV_ORDER.indexOf(a.highestSeverity) ||
      b.events - a.events
  );
}

export async function GET(req: Request) {
  const guard = await guardCyber(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  const { sb } = guard;

  const url = new URL(req.url);
  const view = (url.searchParams.get("view") ?? "ip") as View;
  if (!VIEW_CATEGORIES[view]) {
    return NextResponse.json({ ok: false, error: "Unknown view." }, { status: 400 });
  }

  const hoursRaw = Number(url.searchParams.get("hours") ?? 168);
  const hours = Number.isFinite(hoursRaw) ? Math.min(Math.max(hoursRaw, 1), 720) : 168;
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const { data, error } = await sb
    .from("security_events")
    .select(
      "detected_at,event_type,category,severity,risk_score,actor_email,actor_role,ip_address,endpoint,status,description"
    )
    .in("category", VIEW_CATEGORIES[view])
    .gte("detected_at", since)
    .order("detected_at", { ascending: false })
    .limit(5000);

  if (error) {
    // Distinguish "the store isn't set up" from "the store is empty".
    return NextResponse.json({
      ok: true,
      view,
      hours,
      integrated: false,
      reason:
        "The security_events table is not available. Run supabase/phase68-security-events.sql.",
      gaps: VIEW_GAPS[view],
    });
  }

  const rows = (data ?? []) as EventRow[];

  /* Each view groups by whatever an analyst would actually pivot on. */
  const groups =
    view === "ip"
      ? bucketBy(rows, (r) => r.ip_address)
      : view === "api"
      ? bucketBy(rows, (r) => r.endpoint)
      : view === "owner"
      ? bucketBy(rows, (r) => (r.actor_role === "business" ? r.actor_email : null))
      : bucketBy(rows, (r) => r.endpoint ?? r.event_type);

  /* IP view enriches with the reputation table where it exists. */
  let reputation: Record<string, { block_status: string; risk_score: number }> = {};
  if (view === "ip" && groups.length) {
    const { data: rep } = await sb
      .from("ip_reputation")
      .select("ip,block_status,risk_score")
      .in("ip", groups.slice(0, 200).map((g) => g.key));
    for (const r of (rep ?? []) as {
      ip: string;
      block_status: string;
      risk_score: number;
    }[]) {
      reputation[r.ip] = { block_status: r.block_status, risk_score: r.risk_score };
    }
  }

  const bySeverity: Record<string, number> = {};
  for (const r of rows) bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;

  return NextResponse.json({
    ok: true,
    view,
    hours,
    integrated: true,
    // An empty result set is a real answer; it is not the same as "no source".
    totalEvents: rows.length,
    bySeverity,
    groups: groups.slice(0, 100),
    reputation,
    recent: rows.slice(0, 25),
    gaps: VIEW_GAPS[view],
  });
}
