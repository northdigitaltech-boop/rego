import { createClient } from "@supabase/supabase-js";

/* ============================================================
 * "May this caller do X?" — asked of the database, as the caller.
 *
 * WHY IT DOES NOT USE THE SERVICE-ROLE CLIENT
 *   staff_can() reads auth.uid(). A service-role client has no user, so
 *   auth.uid() is null and staff_can() would answer false for everybody —
 *   which looks like a working permission check right up until nobody can do
 *   anything. Worse would be a copy of the rule written here in TypeScript:
 *   a second implementation that can disagree with the one enforcing RLS.
 *
 *   So this makes an ANON-key client carrying the caller's own token, and
 *   asks the same function every policy asks. One rule, one place.
 *
 * WHAT IT IS FOR
 *   Routes that were admin-only and now also serve staff who hold a specific
 *   permission. The route still verifies the token first; this only answers
 *   the narrower question of what that verified person may do.
 * ============================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * True when the caller is an ACTIVE staff member whose role or personal
 * override grants `permission`, and whose scope covers `location` if one is
 * given.
 *
 * Fails CLOSED. A missing key, a network problem or an unexpected shape all
 * return false, because the alternative is an outage that grants access.
 */
export async function callerCan(
  token: string,
  permission: string,
  location?: string | null
): Promise<boolean> {
  if (!token || !SUPABASE_URL || !ANON_KEY) return false;

  try {
    const sb = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await sb.rpc("staff_can", {
      p_permission: permission,
      p_location: location ?? null,
    });

    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/**
 * True if any one of them is held. For a screen that opens on either
 * "create" or "edit" — refusing to render it to somebody who can do one of
 * the two would be its own bug.
 */
export async function callerCanAny(
  token: string,
  permissions: string[]
): Promise<boolean> {
  for (const p of permissions) {
    if (await callerCan(token, p)) return true;
  }
  return false;
}
