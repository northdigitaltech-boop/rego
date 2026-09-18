/**
 * Lightweight in-memory rate limiter (fixed window) for server routes.
 *
 * NOTE: in-memory state is per server instance. It protects single-instance
 * deployments and dev. For multi-instance / serverless production, back this
 * with a shared store (e.g. Upstash Redis) using the same interface.
 */

type Entry = { count: number; reset: number };

const store = new Map<string, Entry>();
let lastGc = 0;

function gc(now: number) {
  if (now - lastGc < 60_000) return;
  lastGc = now;
  for (const [k, v] of store) if (now > v.reset) store.delete(k);
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfter: number; // seconds until the window resets
}

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  gc(now);
  const e = store.get(key);
  if (!e || now > e.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (e.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((e.reset - now) / 1000) };
  }
  e.count += 1;
  return { ok: true, remaining: limit - e.count, retryAfter: 0 };
}

/* ============================================================
 * The shared-store version (phase133).
 *
 * Same fixed window, same result shape — but the counter lives in
 * Postgres, so every lambda in the deployment increments the SAME
 * number. That is the whole difference: the Map above starts empty
 * on every cold start, which is why a distributed attack mostly
 * never trips it.
 *
 * WHY POSTGRES RATHER THAN REDIS
 *   REGO is already connected to a shared transactional store from
 *   every API route. INSERT .. ON CONFLICT DO UPDATE is atomic, and
 *   atomicity is the only property a fixed-window limiter needs. A
 *   second vendor would add an account, a secret and another thing
 *   that can be down, to solve a problem the database already
 *   solves. If throughput ever outgrows it, this one function is
 *   what changes.
 *
 * IT FALLS BACK RATHER THAN FAILS
 *   If the RPC is missing (phase133 not run) or the database is
 *   briefly unreachable, it drops to the in-memory limiter instead
 *   of throwing. A limiter that takes the route down with it is
 *   worse than one that under-counts for a minute.
 * ============================================================ */
export async function rateLimitShared(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !svc) return rateLimit(key, limit, windowMs);

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, svc, { auth: { persistSession: false } });
    const { data, error } = await sb.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
    });

    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return rateLimit(key, limit, windowMs);

    const r = row as { allowed: boolean; remaining: number; retry_after: number };
    return {
      ok: Boolean(r.allowed),
      remaining: Number(r.remaining) || 0,
      retryAfter: Number(r.retry_after) || 0,
    };
  } catch {
    return rateLimit(key, limit, windowMs);
  }
}

/** Best-effort client IP from common proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
