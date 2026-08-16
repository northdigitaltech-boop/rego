import { NextResponse } from "next/server";

import { guardCyber } from "@/lib/cyber-guard";
import {
  detect,
  ruleCatalogue,
  RULES_VERSION,
  type DetectionEvent,
} from "@/lib/threat-rules";

/* ============================================================
 * Threat detection.
 *
 * Reads recorded events, runs the code-defined rules over them,
 * and returns findings with their evidence. Stateless: nothing
 * is written, nothing is blocked, no account is touched. The
 * portal reports; a human decides.
 * ============================================================ */

export const dynamic = "force-dynamic";

const MAX_EVENTS = 5000;

export async function GET(req: Request) {
  const guard = await guardCyber(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  const { sb } = guard;

  const url = new URL(req.url);
  const hoursRaw = Number(url.searchParams.get("hours") ?? 24);
  const hours = Number.isFinite(hoursRaw) ? Math.min(Math.max(hoursRaw, 1), 720) : 24;
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const { data, error } = await sb
    .from("security_events")
    .select(
      "id,detected_at,event_type,category,severity,risk_score,actor_email,actor_role,ip_address,endpoint,status,description"
    )
    .gte("detected_at", since)
    .order("detected_at", { ascending: false })
    .limit(MAX_EVENTS);

  if (error) {
    return NextResponse.json({
      ok: true,
      integrated: false,
      reason:
        "The security_events table is not available. Run supabase/phase68-security-events.sql.",
      rules: ruleCatalogue(),
      rulesVersion: RULES_VERSION,
    });
  }

  const events = (data ?? []) as DetectionEvent[];
  const findings = detect(events);

  /* If we hit the cap, the window was busier than we could read.
     Say so — a truncated sample can under-report every rule. */
  const truncated = events.length >= MAX_EVENTS;

  return NextResponse.json({
    ok: true,
    integrated: true,
    generatedAt: new Date().toISOString(),
    hours,
    eventsExamined: events.length,
    truncated,
    findings,
    rules: ruleCatalogue(),
    rulesVersion: RULES_VERSION,
    limitations: [
      "Rules run only over events that were recorded. Anything the app does not log is invisible here.",
      "These are threshold rules, not behavioural analysis — a slow attack under every threshold produces no finding.",
      "Rate-limit counters are per server instance, so rate-limit-based rules under-count on serverless.",
      ...(truncated
        ? [
            `The ${MAX_EVENTS}-event read cap was reached, so counts in this window are a floor, not a total.`,
          ]
        : []),
    ],
  });
}
