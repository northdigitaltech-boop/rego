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

/** Best-effort client IP from common proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
