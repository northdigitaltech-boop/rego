import { NextResponse } from "next/server";

import { guardCyber } from "@/lib/cyber-guard";
import { clientIp } from "@/lib/rate-limit";
import { limitAndLogShared } from "@/lib/rate-limit-guard";
import { logSecurityEvent } from "@/lib/security-log";
import { invalidateIpCache } from "@/lib/ip-block";

/* ============================================================
 * Emergency containment.
 *
 * WHAT THIS CAN DO — all reversible, all time-limited:
 *   block_ip     temporary IP block, enforced by enforceIpBlock()
 *   unblock_ip   lift it early
 *   ban_user     Supabase-level account ban with an expiry
 *   unban_user   lift it early
 *
 * WHAT IT DELIBERATELY CANNOT DO:
 *   • delete anything — no user, no listing, no booking, no event
 *   • change a role or grant a permission
 *   • run SQL
 *   • act on its own — every action needs a human and a reason
 *
 * Nothing is permanent. Every action carries an expiry, so the
 * failure mode of a mistake at 3am is "it lifts itself", not
 * "a real customer is locked out forever".
 *
 * Every action writes an append-only row to security_actions AND
 * a security_events row, so containment is itself auditable.
 * ============================================================ */

export const dynamic = "force-dynamic";

const MAX_HOURS = 168; // 7 days. Longer than this should be a deliberate, considered change.
const DEFAULT_HOURS = 24;
const MIN_REASON = 10;

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Very light sanity check — enough to stop a typo becoming a blocked subnet. */
function looksLikeIp(s: string): boolean {
  return /^[0-9a-fA-F:.]{3,45}$/.test(s) && s !== "0.0.0.0" && s !== "::";
}

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
  const limited = await limitAndLogShared(req, `cyber-contain:${ip}`, 60, 15 * 60_000, {
    endpoint: "/api/cyber/contain",
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

  const { data, error } = await sb
    .from("security_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({
      ok: true,
      integrated: false,
      reason:
        "The security_actions table is not available. Run supabase/phase70-containment-actions.sql.",
      actions: [],
    });
  }

  // Which blocks are still in force right now.
  const { data: blocks } = await sb
    .from("ip_reputation")
    .select("ip,blocked_until,blocked_reason")
    .eq("block_status", "temporary")
    .gt("blocked_until", new Date().toISOString());

  return NextResponse.json({
    ok: true,
    integrated: true,
    actions: data ?? [],
    activeBlocks: blocks ?? [],
  });
}

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
  const target = clean(body.target, 320);
  const reason = clean(body.reason, 1000);

  /* A reason is mandatory and must be a sentence, not a keystroke.
     Six months from now the only thing that will explain why an
     address was blocked is what someone typed here. */
  if (reason.length < MIN_REASON) {
    return NextResponse.json(
      { ok: false, error: `Give a reason of at least ${MIN_REASON} characters.` },
      { status: 400 }
    );
  }
  if (!target) {
    return NextResponse.json({ ok: false, error: "No target given." }, { status: 400 });
  }

  const hoursRaw = Number(body.hours ?? DEFAULT_HOURS);
  const hours = Number.isFinite(hoursRaw)
    ? Math.min(Math.max(Math.round(hoursRaw), 1), MAX_HOURS)
    : DEFAULT_HOURS;
  const expiresAt = new Date(Date.now() + hours * 3600_000);

  const record = async (kind: "ip" | "account", extra: Record<string, unknown> = {}) => {
    await sb.from("security_actions").insert({
      action,
      target_kind: kind,
      target,
      actor_email: actor.email,
      reason,
      duration_h: action.startsWith("un") ? null : hours,
      expires_at: action.startsWith("un") ? null : expiresAt.toISOString(),
      ...extra,
    });
    logSecurityEvent({
      event_type: `containment_${action}`,
      category: "admin",
      severity: "high",
      risk_score: 0,
      actor_email: actor.email,
      actor_role: actor.role,
      endpoint: "/api/cyber/contain",
      http_method: "POST",
      status: "allowed",
      description: `${action} on ${target}`,
      // The reason is evidence, not a secret — but it is never echoed
      // back to the target of the action.
      metadata: { source: "server", target, hours, reason },
    });
  };

  /* ---------------- IP ---------------- */

  if (action === "block_ip" || action === "unblock_ip") {
    if (!looksLikeIp(target)) {
      return NextResponse.json(
        { ok: false, error: "That does not look like an IP address." },
        { status: 400 }
      );
    }

    const blocking = action === "block_ip";
    const { error } = await sb.from("ip_reputation").upsert(
      {
        ip: target,
        block_status: blocking ? "temporary" : "none",
        blocked_until: blocking ? expiresAt.toISOString() : null,
        blocked_reason: blocking ? reason : null,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ip" }
    );

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Could not apply the block. Has phase68 been run?" },
        { status: 500 }
      );
    }

    // This instance stops honouring the stale verdict immediately;
    // other instances catch up within the 60s cache window.
    invalidateIpCache(target);
    await record("ip");

    return NextResponse.json({
      ok: true,
      message: blocking
        ? `Blocked until ${expiresAt.toLocaleString()}. Takes up to 60 seconds to apply everywhere.`
        : "Block lifted. Takes up to 60 seconds to apply everywhere.",
    });
  }

  /* ---------------- Account ---------------- */

  if (action === "ban_user" || action === "unban_user") {
    const banning = action === "ban_user";

    // Never ban yourself out of the security console.
    if (target.toLowerCase() === actor.email.toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "You cannot ban your own account from here." },
        { status: 400 }
      );
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("id,role")
      .ilike("email", target)
      .maybeSingle();

    const p = profile as { id: string; role: string } | null;
    if (!p) {
      return NextResponse.json({ ok: false, error: "No such account." }, { status: 404 });
    }

    /* Refuse to ban another admin from here. Admin-on-admin action
       during an incident is exactly what a compromised admin session
       would attempt, and it is not an emergency-button decision. */
    if (p.role === "admin") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This account is an admin. Handle admin accounts deliberately in Supabase, not from an emergency control.",
        },
        { status: 400 }
      );
    }

    const { error } = await sb.auth.admin.updateUserById(p.id, {
      ban_duration: banning ? `${hours}h` : "none",
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Could not apply the ban." },
        { status: 500 }
      );
    }

    await record("account");

    return NextResponse.json({
      ok: true,
      message: banning
        ? `Account banned for ${hours}h. Existing sessions are rejected on their next request.`
        : "Ban lifted.",
    });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
