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

/* BOTH NAMES, IN THE SAME ORDER AS lib/supabase.ts.
   I originally read only NEXT_PUBLIC_SUPABASE_ANON_KEY. This project is
   configured with the newer PUBLISHABLE_KEY, so the variable was empty,
   callerCan() failed closed, and a content writer with every blog permission
   was told "your role does not allow that" — a message that blamed the
   person for a misconfiguration. Read the same pair the rest of the app
   reads. */
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** False when the check cannot be performed at all, as opposed to performed
 *  and refused. The caller needs to tell those apart; the person reading the
 *  screen needs it more. */
export const isPermissionCheckConfigured =
  SUPABASE_URL.startsWith("http") && ANON_KEY.length > 10;

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

    /* p_location is OMITTED when there is none, rather than sent as null.
       staff_can declares it `uuid default null`, and PostgREST has to infer a
       type for an explicit JSON null against a uuid parameter — when it
       cannot, the call errors, and an error here is indistinguishable from a
       refusal because this function fails closed. Leaving it out uses the
       function's own default and removes the guesswork. */
    const args: Record<string, string> = { p_permission: permission };
    if (location) args.p_location = location;

    const { data, error } = await sb.rpc("staff_can", args);

    if (error) {
      /* Server-side only, and only the shape of the failure. The permission
         slug is not a secret; the token is not logged. Without this, a
         misconfigured RPC and a genuine "no" look identical from the outside
         — which is exactly the confusion this whole file has already caused
         once. */
      console.error(
        `[staff-guard] staff_can("${permission}") failed:`,
        error.message
      );
      return false;
    }
    return data === true;
  } catch (e) {
    console.error(`[staff-guard] staff_can("${permission}") threw:`, e);
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
