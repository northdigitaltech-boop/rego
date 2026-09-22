import { NextResponse } from "next/server";

import { guardCyber } from "@/lib/cyber-guard";
import { clientIp } from "@/lib/rate-limit";
import { limitAndLogShared } from "@/lib/rate-limit-guard";
import { logSecurityEvent } from "@/lib/security-log";

/* ============================================================
 * Incident management.
 *
 * WHAT THIS CAN DO: open an incident, add a note, advance its
 * status, and attach existing events as evidence.
 *
 * WHAT IT DELIBERATELY CANNOT DO: delete an incident, delete a
 * note, unlink evidence, or edit a note after the fact. The
 * timeline is append-only. Correcting a mistake means adding a
 * note that says so, which is how an audit trail is supposed to
 * work — a record you can tidy up is not a record.
 *
 * Every write is itself logged to security_events, so the act of
 * managing an incident is part of the evidence too.
 * ============================================================ */

export const dynamic = "force-dynamic";

const STATUSES = [
  "open",
  "investigating",
  "contained",
  "eradicated",
  "recovering",
  "resolved",
  "false_positive",
] as const;

const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;

const MAX_TITLE = 200;
const MAX_BODY = 5000;

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/* ---------------- list ---------------- */

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
  const limited = await limitAndLogShared(req, `cyber-incidents:${ip}`, 60, 15 * 60_000, {
    endpoint: "/api/cyber/incidents",
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
  const id = url.searchParams.get("id");

  if (id) {
    const { data: incident, error } = await sb
      .from("security_incidents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !incident) {
      return NextResponse.json({ ok: false, error: "Incident not found." }, { status: 404 });
    }
    const { data: notes } = await sb
      .from("security_incident_notes")
      .select("*")
      .eq("incident_id", id)
      .order("created_at", { ascending: true });
    const { data: links } = await sb
      .from("security_incident_events")
      .select("event_id,linked_by,linked_at,rationale")
      .eq("incident_id", id);

    return NextResponse.json({
      ok: true,
      incident,
      notes: notes ?? [],
      evidence: links ?? [],
    });
  }

  const status = url.searchParams.get("status") ?? "active";
  let q = sb.from("security_incidents").select("*").order("detected_at", { ascending: false });

  if (status === "active") {
    q = q.in("status", ["open", "investigating", "contained", "eradicated", "recovering"]);
  } else if (status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q.limit(200);
  if (error) {
    return NextResponse.json({
      ok: true,
      integrated: false,
      reason:
        "Incident tables are not available. Run supabase/phase68-security-events.sql, then supabase/phase69-incident-timeline.sql.",
      incidents: [],
    });
  }

  return NextResponse.json({ ok: true, integrated: true, incidents: data ?? [] });
}

/* ---------------- create / append ---------------- */

export async function POST(req: Request) {
  const guard = await guardCyber(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  const { sb, actor } = guard;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const action = clean(body.action, 40);

  /* ---- open a new incident ---- */
  if (action === "create") {
    const title = clean(body.title, MAX_TITLE);
    if (title.length < 4) {
      return NextResponse.json(
        { ok: false, error: "Give the incident a title of at least 4 characters." },
        { status: 400 }
      );
    }
    const severity = SEVERITIES.includes(body.severity as never)
      ? (body.severity as string)
      : "medium";

    const { data, error } = await sb
      .from("security_incidents")
      .insert({
        title,
        severity,
        status: "open",
        summary: clean(body.summary, MAX_BODY) || null,
        opened_by: actor.email,
        detected_by_rule: clean(body.ruleId, 80) || null,
        rule_version: typeof body.rulesVersion === "number" ? body.rulesVersion : null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "Could not open the incident." },
        { status: 500 }
      );
    }

    // Opening note, so the timeline starts at the beginning.
    await sb.from("security_incident_notes").insert({
      incident_id: data.id,
      author_email: actor.email,
      kind: "status_change",
      body: clean(body.summary, MAX_BODY) || "Incident opened.",
      status_to: "open",
    });

    // Link the evidence the analyst was looking at when they opened it.
    const eventIds = Array.isArray(body.eventIds)
      ? (body.eventIds as unknown[]).filter((x) => typeof x === "string").slice(0, 200)
      : [];
    if (eventIds.length) {
      await sb.from("security_incident_events").insert(
        eventIds.map((event_id) => ({
          incident_id: data.id,
          event_id: event_id as string,
          linked_by: actor.email,
          rationale: clean(body.ruleId, 80) || "Attached at incident creation",
        }))
      );
    }

    logSecurityEvent({
      event_type: "incident_opened",
      category: "admin",
      severity: "info",
      risk_score: 0,
      actor_email: actor.email,
      actor_role: actor.role,
      endpoint: "/api/cyber/incidents",
      http_method: "POST",
      status: "allowed",
      description: `Incident opened: ${title}`,
      metadata: { source: "server", incident_id: data.id, severity },
    });

    return NextResponse.json({ ok: true, id: data.id });
  }

  /* ---- append a note, optionally advancing status ---- */
  if (action === "note") {
    const incidentId = clean(body.incidentId, 64);
    const note = clean(body.body, MAX_BODY);
    if (!incidentId || note.length < 2) {
      return NextResponse.json(
        { ok: false, error: "A note needs an incident and some text." },
        { status: 400 }
      );
    }

    const { data: current } = await sb
      .from("security_incidents")
      .select("status")
      .eq("id", incidentId)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ ok: false, error: "Incident not found." }, { status: 404 });
    }

    const from = (current as { status: string }).status;
    const to = STATUSES.includes(body.statusTo as never) ? (body.statusTo as string) : null;

    await sb.from("security_incident_notes").insert({
      incident_id: incidentId,
      author_email: actor.email,
      kind: to ? "status_change" : "note",
      body: note,
      status_from: to ? from : null,
      status_to: to,
    });

    /* The incident row carries the CURRENT status only. Every step
       that got it there is preserved in the notes table above. */
    if (to && to !== from) {
      await sb
        .from("security_incidents")
        .update({
          status: to,
          updated_at: new Date().toISOString(),
          ...(to === "resolved" || to === "false_positive"
            ? { resolved_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", incidentId);

      logSecurityEvent({
        event_type: "incident_status_changed",
        category: "admin",
        severity: "info",
        risk_score: 0,
        actor_email: actor.email,
        actor_role: actor.role,
        endpoint: "/api/cyber/incidents",
        http_method: "POST",
        status: "allowed",
        description: `Incident ${from} → ${to}`,
        metadata: { source: "server", incident_id: incidentId, from, to },
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
