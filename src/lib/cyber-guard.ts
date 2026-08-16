import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { logSecurityEvent } from "@/lib/security-log";

/* ============================================================
 * Authorisation for every /api/cyber/* route.
 *
 * Three independent checks, all server-side:
 *   1. same-origin          — blocks cross-site callers
 *   2. valid session + admin — verified against the database, not a claim
 *   3. email allowlist       — CYBER_ADMINS, a server-only env var
 *
 * Why the allowlist matters: an attacker who promotes themselves to
 * role='admin' in the database still cannot reach /cyber, because the
 * allowlist lives in Vercel's environment, outside the database blast
 * radius. Compromising one does not compromise the other.
 *
 * Nothing here modifies existing auth. It reads the same Supabase session
 * the rest of the app already issues.
 * ============================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function cyberClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

/** Emails permitted into /cyber. Empty means nobody — fail closed. */
function allowlist(): string[] {
  return (process.env.CYBER_ADMINS ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export interface CyberActor {
  email: string;
  role: string;
  id: string;
}

export type GuardResult =
  | { ok: true; actor: CyberActor; sb: SupabaseClient }
  | { ok: false; status: number; error: string };

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
 * Guard a /cyber API route.
 *
 * Deliberately returns the SAME generic message for "not an admin" and
 * "not on the allowlist". Telling an attacker which check they failed
 * hands them a map.
 */
export async function guardCyber(req: Request): Promise<GuardResult> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { ok: false, status: 500, error: "Security center is not configured." };
  }
  if (!sameOrigin(req)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const list = allowlist();
  if (list.length === 0) {
    // Fail closed: an unset CYBER_ADMINS must never mean "open to all".
    return {
      ok: false,
      status: 503,
      error: "Security center is not enabled. Set CYBER_ADMINS in the server environment.",
    };
  }

  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Not signed in." };

  const sb = cyberClient();
  const { data: caller, error } = await sb.auth.getUser(token);
  if (error || !caller?.user?.email) {
    return { ok: false, status: 401, error: "Invalid session." };
  }
  const email = caller.user.email.toLowerCase();

  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", caller.user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role ?? "";

  // Both conditions, one message.
  if (role !== "admin" || !list.includes(email)) {
    /* The security portal monitors attempts on itself. Someone with a valid
       session probing /cyber is a signal worth keeping, and it's high
       severity precisely because they already got past authentication. */
    logSecurityEvent({
      event_type: "authz_violation",
      category: "authz",
      severity: "high",
      risk_score: 55,
      actor_email: email,
      actor_role: role || "unknown",
      ip_address: requestIp(req),
      user_agent: req.headers.get("user-agent"),
      endpoint: new URL(req.url).pathname,
      http_method: req.method,
      status: "blocked",
      description: "Access to the security center denied",
      metadata: {
        source: "server",
        // Which check failed — useful to an analyst, never shown to the caller.
        reason: role !== "admin" ? "not_admin" : "not_allowlisted",
      },
    });
    return { ok: false, status: 403, error: "Not authorised." };
  }

  return { ok: true, actor: { email, role, id: caller.user.id }, sb };
}

/** Client IP as seen through Vercel's proxy chain. */
export function requestIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
