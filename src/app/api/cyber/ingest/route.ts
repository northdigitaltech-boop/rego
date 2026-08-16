import { NextResponse } from "next/server";

import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logSecurityEvent, scoreEvent } from "@/lib/security-log";

/* ============================================================
 * Client-reported security events (authentication only).
 *
 * WHY THIS EXISTS: Rego authenticates in the browser against Supabase, so
 * the server never sees a failed login. The browser is the only witness.
 *
 * HONEST LIMITATION: anything the client reports is, by definition,
 * spoofable. Someone could POST fake "login_failed" events here. So:
 *
 *   * Only a fixed ALLOWLIST of low-trust auth event types is accepted.
 *     No admin, authz, or privileged event can ever enter this way — those
 *     are written server-side where they can be trusted.
 *   * IP and user-agent are taken from the REQUEST, never from the body,
 *     so those fields cannot be forged.
 *   * Rate limited per IP.
 *   * Events land with a `source: "client"` marker so an analyst can see
 *     exactly how much to trust each row.
 *
 * Treat these as signal, not evidence.
 * ============================================================ */

export const dynamic = "force-dynamic";

/** Only these may be reported by a browser. Nothing privileged. */
const CLIENT_EVENTS: Record<string, { category: "auth" | "session" }> = {
  login_failed: { category: "auth" },
  login_success: { category: "auth" },
  mfa_failed: { category: "auth" },
  mfa_success: { category: "auth" },
  password_reset_requested: { category: "auth" },
  signup_blocked_email: { category: "auth" },
  captcha_failed: { category: "auth" },
  logout: { category: "session" },
};

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

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const ip = clientIp(req);
  // Generous but finite — a burst of failed logins is exactly what we want
  // to record, but not an unbounded write channel.
  const rl = rateLimit(`cyber-ingest:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: { event?: string; email?: string; detail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const spec = CLIENT_EVENTS[String(body.event ?? "")];
  if (!spec) {
    // Unknown or privileged type — refuse silently.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { score, severity } = scoreEvent(String(body.event));

  logSecurityEvent({
    event_type: String(body.event),
    category: spec.category,
    severity,
    risk_score: score,
    actor_email: body.email ?? null,
    // Taken from the request — cannot be forged by the caller.
    ip_address: ip,
    user_agent: req.headers.get("user-agent"),
    endpoint: "/api/cyber/ingest",
    http_method: "POST",
    status: String(body.event).includes("failed") ? "failed" : "success",
    description: body.detail ? String(body.detail).slice(0, 200) : null,
    // Provenance marker: lets an analyst weigh this row correctly.
    metadata: { source: "client" },
  });

  return NextResponse.json({ ok: true });
}
