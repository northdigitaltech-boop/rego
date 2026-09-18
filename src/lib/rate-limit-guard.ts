import { rateLimit, rateLimitShared, clientIp, type RateResult } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

/* ============================================================
 * Rate limiting that also leaves evidence.
 *
 * This is a thin wrapper over the existing rateLimit() — same
 * arguments, same return value. Routes that switch to it keep
 * behaving exactly as before; the only difference is that a
 * denial now writes a security_events row.
 *
 * IMPORTANT HONESTY NOTE
 * ----------------------
 * The underlying limiter stores its counters in memory, per
 * server instance. On Vercel every cold start begins with an
 * empty map, so a distributed or slow-drip attack will often
 * never trip it. That means:
 *
 *   a low "rate limited" count in /cyber does NOT mean
 *   "nobody is abusing the API" — it may mean the limiter
 *   never saw enough traffic in one instance to fire.
 *
 * The IP and API pages say this on screen. Backing rateLimit()
 * with a shared store (Upstash Redis fits the same interface)
 * is what turns this number into a real one.
 * ============================================================ */

export interface GuardedLimitOptions {
  /** Route path, for grouping in the security center. */
  endpoint: string;
  /** Who tripped it, when the route already knows. Never required. */
  actorEmail?: string | null;
  /** Overrides the derived category, e.g. "auth" for sign-in routes. */
  category?: "api" | "auth" | "booking" | "upload" | "admin";
}

/**
 * Apply a rate limit and record the denial.
 *
 * Returns the same RateResult the caller already handles, so adopting
 * this is a one-line change at each call site with no behaviour change
 * on the allow path.
 */
export function limitAndLog(
  req: Request,
  key: string,
  limit: number,
  windowMs: number,
  opts: GuardedLimitOptions
): RateResult {
  const result = rateLimit(key, limit, windowMs);
  if (result.ok) return result;

  const ip = clientIp(req);
  logSecurityEvent({
    event_type: "rate_limited",
    category: opts.category ?? "ratelimit",
    severity: "medium",
    risk_score: 25,
    actor_email: opts.actorEmail ?? null,
    ip_address: ip,
    user_agent: req.headers.get("user-agent"),
    endpoint: opts.endpoint,
    http_method: req.method,
    status: "blocked",
    description: `Rate limit reached on ${opts.endpoint}`,
    metadata: {
      source: "server",
      limit,
      window_ms: windowMs,
      retry_after_s: result.retryAfter,
      // The limiter is per-instance; say so in the evidence itself so
      // nobody later reads these rows as a complete picture.
      limiter: "in-memory-per-instance",
    },
  });

  return result;
}

/**
 * The same thing, counted across the whole deployment (phase133).
 *
 * Identical arguments and return value to limitAndLog — the only
 * differences are that it is async, and that the number it checks is real.
 * Adopting it at a call site is `await` plus the new name.
 *
 * The honesty note above stops applying to routes that use this: the
 * counter lives in Postgres, so a denial here means the limit was genuinely
 * reached across every instance, and a LOW count genuinely means low
 * traffic. That distinction is recorded in the event metadata so the
 * security centre can tell the two kinds of row apart while routes are
 * being migrated across.
 */
export async function limitAndLogShared(
  req: Request,
  key: string,
  limit: number,
  windowMs: number,
  opts: GuardedLimitOptions
): Promise<RateResult> {
  const result = await rateLimitShared(key, limit, windowMs);
  if (result.ok) return result;

  logSecurityEvent({
    event_type: "rate_limited",
    category: opts.category ?? "ratelimit",
    severity: "medium",
    risk_score: 25,
    actor_email: opts.actorEmail ?? null,
    ip_address: clientIp(req),
    user_agent: req.headers.get("user-agent"),
    endpoint: opts.endpoint,
    http_method: req.method,
    status: "blocked",
    description: `Rate limit reached on ${opts.endpoint}`,
    metadata: {
      source: "server",
      limit,
      window_ms: windowMs,
      retry_after_s: result.retryAfter,
      limiter: "shared-postgres",
    },
  });

  return result;
}
