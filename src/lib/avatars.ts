"use client";

import { supabase } from "@/lib/supabase";

/* ============================================================
 * Look up profile pictures by email.
 *
 * Chat threads only carry an email address, so anywhere we want
 * to show the other person's photo we have to resolve it. This
 * does that in ONE query for a whole list rather than one per
 * row — a 40-thread inbox would otherwise fire 40 requests.
 *
 * Results are cached for the page session. A profile picture
 * changing a few seconds late in an already-open list is not
 * worth re-querying on every render.
 *
 * RLS NOTE: profiles is self-read only, so this returns nothing
 * for ordinary users unless a policy allows reading other
 * people's avatar. See supabase/phase71-avatar-visibility.sql —
 * it exposes ONLY id, email and avatar, never role or anything
 * else on the row.
 * ============================================================ */

const cache = new Map<string, string | null>();

export async function getAvatarsByEmail(
  emails: string[]
): Promise<Record<string, string>> {
  const wanted = Array.from(
    new Set(emails.map((e) => (e || "").trim().toLowerCase()).filter(Boolean))
  );
  if (wanted.length === 0) return {};

  const out: Record<string, string> = {};
  const missing: string[] = [];

  for (const e of wanted) {
    if (cache.has(e)) {
      const v = cache.get(e);
      if (v) out[e] = v;
    } else {
      missing.push(e);
    }
  }
  if (missing.length === 0) return out;

  try {
    /* A function, not the public_avatars view.
     *
     * The view returns id, email and avatar for EVERY profile to any
     * signed-in user. This code has always asked only for addresses it
     * already had, but the view never required that — one `select email from
     * public_avatars` returns every address on the platform. Supabase's
     * advisor flags it for being SECURITY DEFINER, which was deliberate; the
     * email dump is the part that actually matters.
     *
     * avatars_for_emails (phase103) answers for the addresses handed to it
     * and nothing else, so there is no list to take.
     */
    let { data, error } = await supabase.rpc("avatars_for_emails", {
      p_emails: missing,
    });

    if (error) {
      /* phase103 has not been run yet. Fall back to the view so avatars keep
         working through the gap between this deploy and that migration —
         they are two different machines and arrive in either order. */
      ({ data, error } = await supabase
        .from("public_avatars")
        .select("email, avatar")
        .in("email", missing));
    }

    if (error) {
      /* Cache the misses too. Without this a failing policy causes the
         same query to repeat on every poll tick. */
      for (const e of missing) cache.set(e, null);
      return out;
    }

    const rows = (data ?? []) as { email: string | null; avatar: string | null }[];
    const found = new Set<string>();
    for (const r of rows) {
      const key = (r.email || "").trim().toLowerCase();
      if (!key) continue;
      found.add(key);
      cache.set(key, r.avatar || null);
      if (r.avatar) out[key] = r.avatar;
    }
    // Anyone not returned has no profile row — remember that too.
    for (const e of missing) if (!found.has(e)) cache.set(e, null);
  } catch {
    for (const e of missing) cache.set(e, null);
  }

  return out;
}

/** Called after someone changes their own picture, so it refreshes. */
export function clearAvatarCache(email?: string): void {
  if (email) cache.delete(email.trim().toLowerCase());
  else cache.clear();
}
