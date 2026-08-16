import { NextResponse } from "next/server";

import { guardCyber } from "@/lib/cyber-guard";

/* ============================================================
 * Security Overview data.
 *
 * Every number below is COUNTED FROM REAL ROWS. Where a source does not
 * exist yet, the field is returned as null and the UI renders
 * "Not integrated" rather than a zero or an invented figure — a security
 * dashboard that reports comforting fiction is worse than none.
 * ============================================================ */

export const dynamic = "force-dynamic";

type Counts = Record<string, number>;

export async function GET(req: Request) {
  const guard = await guardCyber(req);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status }
    );
  }
  const { sb } = guard;

  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();

  /* ---- security_events: may not exist until phase68 is run ---- */
  let eventsAvailable = true;
  const bySeverity: Counts = {};
  const byCategory: Counts = {};
  let total24h = 0;

  const { data: events, error: evErr } = await sb
    .from("security_events")
    .select("severity,category,status")
    .gte("detected_at", since24h)
    .limit(5000);

  if (evErr) {
    // Table missing → say so honestly rather than reporting "0 threats".
    eventsAvailable = false;
  } else {
    for (const e of (events ?? []) as {
      severity: string;
      category: string;
      status: string | null;
    }[]) {
      total24h += 1;
      bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    }
  }

  /* ---- open incidents ---- */
  let openIncidents: number | null = null;
  const { count: incCount, error: incErr } = await sb
    .from("security_incidents")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "investigating", "contained", "recovering"]);
  if (!incErr) openIncidents = incCount ?? 0;

  /* ---- unresolved vulnerabilities ---- */
  let openVulns: number | null = null;
  const { count: vulnCount, error: vulnErr } = await sb
    .from("security_vulnerabilities")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"]);
  if (!vulnErr) openVulns = vulnCount ?? 0;

  /* ---- blocked IPs ---- */
  let blockedIps: number | null = null;
  const { count: ipCount, error: ipErr } = await sb
    .from("ip_reputation")
    .select("ip", { count: "exact", head: true })
    .eq("block_status", "temporary");
  if (!ipErr) blockedIps = ipCount ?? 0;

  /* ---- reuse the EXISTING admin audit log (phase31) ---- */
  let adminActions24h: number | null = null;
  const { count: auditCount, error: auditErr } = await sb
    .from("admin_audit_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since24h);
  if (!auditErr) adminActions24h = auditCount ?? 0;

  /* ---- account totals, for context on the risk picture ---- */
  let admins: number | null = null;
  const { count: adminCount, error: aErr } = await sb
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (!aErr) admins = adminCount ?? 0;

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    window: "24h",

    // null anywhere below means "no source yet" — never render it as zero.
    events: eventsAvailable
      ? { total: total24h, bySeverity, byCategory }
      : null,

    openIncidents,
    openVulns,
    blockedIps,
    adminActions24h,
    admins,

    // Honest declaration of what has no data source at all yet.
    notIntegrated: [
      ...(eventsAvailable ? [] : ["Security events (run phase68 SQL)"]),
      "Backup & recovery status",
      "Dependency scanning (npm audit / Dependabot)",
      "Static analysis (CodeQL)",
      "Infrastructure metrics",
    ],
  });
}
