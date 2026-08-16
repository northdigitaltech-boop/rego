import { createClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

/* ============================================================
 * IP block ENFORCEMENT.
 *
 * This is the half that makes the Emergency page real. Without
 * it, "Block this address" would write a row to a table nobody
 * reads — a button that lies to you during an incident, which is
 * the worst possible time to be lied to.
 *
 * HOW IT WORKS
 *   ip_reputation.block_status = 'temporary' + blocked_until in
 *   the future  →  the route returns 403.
 *
 * HONEST LIMITATIONS — these are real, please read them:
 *
 *   1. It only protects routes that CALL enforceIpBlock(). It is
 *      not middleware, so page loads and un-wired routes are not
 *      covered. The Emergency page lists exactly which routes are.
 *
 *   2. The 60-second cache is per server instance. A block can
 *      take up to a minute to take effect everywhere, and a
 *      cold-started instance fetches fresh.
 *
 *   3. IP blocking is weak containment. Anyone can change address
 *      with a phone hotspot or a VPN. Treat it as slowing an
 *      attacker down, never as stopping them.
 *
 *   4. It FAILS OPEN. If the database is unreachable we allow the
 *      request. Blocking your whole site because a lookup timed
 *      out would turn a small incident into an outage — but it
 *      does mean a database problem silently disables blocking.
 * ============================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  blockedUntil: number | null; // epoch ms, null = not blocked
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Drop the cached verdict for one IP so a change applies immediately here. */
export function invalidateIpCache(ip: string): void {
  cache.delete(ip);
}

async function lookup(ip: string): Promise<number | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });
    const { data, error } = await sb
      .from("ip_reputation")
      .select("block_status,blocked_until")
      .eq("ip", ip)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as { block_status: string; blocked_until: string | null };
    if (row.block_status !== "temporary" || !row.blocked_until) return null;

    const until = new Date(row.blocked_until).getTime();
    return Number.isFinite(until) && until > Date.now() ? until : null;
  } catch {
    // Fail open — see limitation 4 above.
    return null;
  }
}

export interface BlockVerdict {
  blocked: boolean;
  retryAfterSeconds: number;
}

/**
 * Check whether the request's source address is currently blocked.
 *
 * Call this at the TOP of a route, before any work. Returns a plain
 * verdict; the caller decides the response, so this cannot change
 * behaviour it was not explicitly asked to change.
 */
export async function checkIpBlock(req: Request): Promise<BlockVerdict> {
  const ip = clientIp(req);
  if (!ip || ip === "unknown") return { blocked: false, retryAfterSeconds: 0 };

  const now = Date.now();
  const hit = cache.get(ip);

  let blockedUntil: number | null;
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    blockedUntil = hit.blockedUntil;
  } else {
    blockedUntil = await lookup(ip);
    cache.set(ip, { blockedUntil, fetchedAt: now });
  }

  if (blockedUntil === null || blockedUntil <= now) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  /* Record that the block actually did something. Without this you
     could never tell an effective block from a decorative one. */
  logSecurityEvent({
    event_type: "ip_block_enforced",
    category: "authz",
    severity: "medium",
    risk_score: 30,
    ip_address: ip,
    user_agent: req.headers.get("user-agent"),
    endpoint: new URL(req.url).pathname,
    http_method: req.method,
    status: "blocked",
    description: "Request refused — address is under a temporary block",
    metadata: { source: "server", blocked_until: new Date(blockedUntil).toISOString() },
  });

  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
  };
}

/**
 * Convenience wrapper: returns a ready 403 Response when blocked,
 * or null to continue. Keeps call sites to two lines.
 *
 * The message is deliberately vague. Telling someone "you are
 * blocked until 14:32" tells them exactly when to come back.
 */
export async function enforceIpBlock(req: Request): Promise<Response | null> {
  const v = await checkIpBlock(req);
  if (!v.blocked) return null;
  return new Response(
    JSON.stringify({ ok: false, error: "Request refused." }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(v.retryAfterSeconds),
      },
    }
  );
}

// Declared separately so client components can read it safely.
export { ENFORCED_ROUTES } from "@/lib/enforced-routes";
