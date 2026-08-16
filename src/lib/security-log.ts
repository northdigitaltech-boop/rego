import { createClient } from "@supabase/supabase-js";

/* ============================================================
 * Server-side security event writer.
 *
 * Rules this enforces:
 *  1. NEVER blocks the request that triggered it. Every write is
 *     fire-and-forget with errors swallowed — a logging outage must not
 *     stop a login, a booking, or anything else.
 *  2. NEVER stores secrets. `metadata` is scrubbed of anything that looks
 *     like a credential before it is written (see SENSITIVE_KEYS).
 *  3. Writes with the service role, because security_events has no insert
 *     policy at all — the table is append-only from the app's perspective.
 * ============================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type SecurityCategory =
  | "auth"
  | "authz"
  | "admin"
  | "api"
  | "booking"
  | "db"
  | "upload"
  | "session"
  | "ratelimit"
  | "infra";

export interface SecurityEventInput {
  event_type: string;
  category: SecurityCategory;
  severity?: Severity;
  risk_score?: number;
  actor_email?: string | null;
  actor_role?: string | null;
  target_email?: string | null;
  ip_address?: string | null;
  country?: string | null;
  city?: string | null;
  user_agent?: string | null;
  endpoint?: string | null;
  http_method?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  action?: string | null;
  status?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  correlation_id?: string | null;
}

/** Anything matching these is dropped from metadata before storage. */
const SENSITIVE_KEYS =
  /pass|pwd|secret|token|jwt|cookie|session|otp|code|key|auth|card|cvv|iban|account_number/i;

/**
 * Strip credentials from arbitrary metadata. Defence in depth: callers are
 * told not to pass secrets, but one careless call shouldn't put a token in
 * a table several people can read.
 */
function scrub(meta: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (typeof v === "string" && v.length > 500) {
      out[k] = v.slice(0, 500) + "…";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = scrub(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Truncate free text so a hostile input can't bloat the table. */
function cap(s: string | null | undefined, n = 500): string | null {
  if (!s) return null;
  const t = String(s).trim();
  return t ? t.slice(0, n) : null;
}

/**
 * Record a security event. Returns immediately; the write happens in the
 * background and failures are silent by design.
 */
export function logSecurityEvent(input: SecurityEventInput): void {
  if (!SUPABASE_URL || !SERVICE_KEY) return;

  const row = {
    event_type: cap(input.event_type, 80),
    category: input.category,
    severity: input.severity ?? "info",
    risk_score: Math.max(0, Math.min(100, input.risk_score ?? 0)),
    actor_email: cap(input.actor_email, 160)?.toLowerCase() ?? null,
    actor_role: cap(input.actor_role, 40),
    target_email: cap(input.target_email, 160)?.toLowerCase() ?? null,
    ip_address: cap(input.ip_address, 60),
    country: cap(input.country, 80),
    city: cap(input.city, 80),
    user_agent: cap(input.user_agent, 300),
    endpoint: cap(input.endpoint, 200),
    http_method: cap(input.http_method, 10),
    resource_type: cap(input.resource_type, 60),
    resource_id: cap(input.resource_id, 100),
    action: cap(input.action, 60),
    status: cap(input.status, 40),
    description: cap(input.description, 500),
    metadata: scrub(input.metadata),
    correlation_id: cap(input.correlation_id, 80),
  };

  void (async () => {
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false },
      });
      await sb.from("security_events").insert(row);
    } catch {
      /* telemetry must never surface an error to the caller */
    }
  })();
}

/* ---------------- risk scoring ---------------- */

/**
 * Transparent, rule-based scoring. Deliberately simple: every number here
 * can be explained to an auditor, and the reasons travel with the score so
 * the UI can always show WHY something was rated as it was.
 */
export function scoreEvent(
  type: string,
  ctx: { repeated?: number; sensitiveRole?: boolean } = {}
): { score: number; severity: Severity; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const base: Record<string, number> = {
    login_failed: 15,
    mfa_failed: 30,
    password_reset_requested: 10,
    authz_violation: 55,
    rate_limited: 25,
    admin_role_changed: 80,
    admin_created: 70,
    user_deleted: 60,
    suspicious_session: 45,
    upload_rejected: 20,
    bulk_operation: 50,
  };

  score = base[type] ?? 5;
  reasons.push(`Base score for "${type}": ${score}`);

  if (ctx.repeated && ctx.repeated > 3) {
    const add = Math.min(30, ctx.repeated * 3);
    score += add;
    reasons.push(`Repeated ${ctx.repeated}× in a short window: +${add}`);
  }
  if (ctx.sensitiveRole) {
    score += 15;
    reasons.push("Actor holds a privileged role: +15");
  }

  score = Math.max(0, Math.min(100, score));

  const severity: Severity =
    score >= 81 ? "critical"
    : score >= 61 ? "high"
    : score >= 41 ? "medium"
    : score >= 21 ? "low"
    : "info";

  return { score, severity, reasons };
}
