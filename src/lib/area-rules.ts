import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Area rules — the provider-facing side.
 *
 * NONE OF THIS IS ENFORCEMENT.
 *
 * Provider forms write to Supabase directly with the anon key,
 * so anything checked here can be skipped by anyone willing to
 * call the REST endpoint by hand. The real gate is the database
 * trigger in phase76-area-enforcement.sql.
 *
 * What this file is for: telling an honest provider, before
 * they spend ten minutes filling in a form, that their area is
 * closed — and turning the database's error into a sentence a
 * human can act on.
 * ============================================================ */

export interface AreaOption {
  id: string;
  name: string;
  location_type: string;
  depth: number;
  parent_id: string | null;
  path: string;
}

export interface EnforcementConfig {
  enforceEnabled: boolean;
  requireLocationId: boolean;
  blockedMessage: string;
}

const FALLBACK_MESSAGE =
  "We are not accepting new listings in this area right now.";

export async function getEnforcementConfig(): Promise<EnforcementConfig> {
  if (!isSupabaseConfigured) {
    return { enforceEnabled: false, requireLocationId: false, blockedMessage: FALLBACK_MESSAGE };
  }
  const { data } = await supabase
    .from("market_enforcement")
    .select("enforce_enabled, require_location_id, blocked_message")
    .maybeSingle();

  const row = data as {
    enforce_enabled?: boolean;
    require_location_id?: boolean;
    blocked_message?: string;
  } | null;

  /* Default to OFF when the row is missing or unreadable. A failed read must
     never be interpreted as "enforcement is on" — that would show providers a
     blocked message for an area that is perfectly open. */
  return {
    enforceEnabled: Boolean(row?.enforce_enabled),
    requireLocationId: Boolean(row?.require_location_id),
    blockedMessage: row?.blocked_message || FALLBACK_MESSAGE,
  };
}

/**
 * Areas a provider may pick from, for one service.
 *
 * Only returns areas that are public AND currently open to new listings for
 * that service, so a closed area never appears as an option in the first
 * place. Resolution happens in the database via resolve_location_flag, so
 * this list agrees with the trigger by construction rather than by luck.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ONE RPC AND NOT A SELECT INTERSECTED WITH AN RPC
 *
 * It used to read public.locations directly and keep the rows the RPC also
 * returned. The RPC part was fine. The select was not: it runs as the
 * signed-in user, and the read policy on locations is `is_public is true` on
 * the row itself, with no inheritance — correct for a public boundary, and
 * no migration has ever set that column on any location.
 *
 * So for anyone who is not an admin the select returned nothing, the
 * intersection was empty, and the picker rendered nothing at all. It looked
 * correct in testing because an admin session reads the whole tree. A bug
 * that behaves for the person checking it is the expensive kind.
 *
 * areas_open_for_listings_tree (phase97) returns the same rows as the
 * original function with the parent links attached, computed server-side
 * where the permission question has already been answered properly.
 * ---------------------------------------------------------------------------
 */
export async function getSubmittableAreas(serviceSlug: string): Promise<AreaOption[]> {
  if (!isSupabaseConfigured) return [];

  interface TreeRow {
    id: string;
    name: string;
    path: string | null;
    parent_id: string | null;
    location_type: string;
    depth: number;
  }

  const { data, error } = await supabase.rpc("areas_open_for_listings_tree", {
    p_service: serviceSlug,
  });

  if (!error) {
    return ((data as TreeRow[] | null) ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      location_type: r.location_type,
      depth: r.depth,
      parent_id: r.parent_id,
      path: r.path ?? "",
    }));
  }

  /* phase97 has not been run yet. Fall back to the older function, which
     exists since phase76 and returns the same rows without the parent links.
     Everything still works — the picker just cannot nest, so it shows one
     list. That is the behaviour before this change, which is the right thing
     to degrade to rather than showing an empty form field. */
  const { data: flat } = await supabase.rpc("areas_open_for_listings", {
    p_service: serviceSlug,
  });

  return ((flat as { id: string; name: string; path: string | null }[] | null) ?? []).map(
    (r) => ({
      id: r.id,
      name: r.name,
      /* Unknown without the tree function. "area" keeps every row at one
         level, which is exactly what the flat fallback should look like. */
      location_type: "area",
      depth: 0,
      parent_id: null,
      path: r.path ?? "",
    })
  );
}

/**
 * Turn a Postgres error into something a provider can act on.
 *
 * The trigger raises check_violation with the admin-configured message, but
 * Supabase surfaces it wrapped in Postgres phrasing. Showing that raw makes a
 * deliberate business rule look like a crash.
 */
export function friendlyAreaError(message: string | undefined | null): string | null {
  if (!message) return null;
  const m = message.toLowerCase();

  if (m.includes("a location is required")) {
    return "Please choose the area this listing is in before saving.";
  }
  if (
    m.includes("not accepting new listings") ||
    m.includes("listings are closed") ||
    m.includes("area is not active")
  ) {
    // The trigger's message is already written for providers — pass it through,
    // stripped of any Postgres prefix.
    return message.replace(/^.*?violation:\s*/i, "").trim();
  }
  return null;
}
