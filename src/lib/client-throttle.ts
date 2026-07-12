"use client";

/**
 * Lightweight client-side cooldown (sliding window) for sensitive form
 * submissions — login, signup, contact, etc.
 *
 * IMPORTANT: this is *defense-in-depth* only, not a security boundary. A
 * determined attacker can bypass it by calling the backend directly. Real
 * throttling for these actions requires server-side enforcement (Supabase
 * Auth's built-in limits once real auth is enabled, or server-routed mutations
 * guarded by `@/lib/rate-limit`). Use this to curb accidental spam and casual
 * abuse from the UI.
 */
export function clientThrottle(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  try {
    const k = `sgb_rl_${key}`;
    const now = Date.now();
    const hits: number[] = (JSON.parse(localStorage.getItem(k) || "[]") as number[]).filter(
      (t) => now - t < windowMs
    );
    if (hits.length >= limit) {
      return { ok: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000) };
    }
    hits.push(now);
    localStorage.setItem(k, JSON.stringify(hits));
    return { ok: true, retryAfter: 0 };
  } catch {
    // localStorage unavailable — fail open (don't block legitimate users).
    return { ok: true, retryAfter: 0 };
  }
}
