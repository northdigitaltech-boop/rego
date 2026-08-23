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
 */
export async function getSubmittableAreas(serviceSlug: string): Promise<AreaOption[]> {
  if (!isSupabaseConfigured) return [];

  const { data } = await supabase
    .from("locations")
    .select("id, name, location_type, depth, parent_id, path_slugs, is_public")
    .order("depth")
    .order("display_order");

  interface Raw {
    id: string;
    name: string;
    location_type: string;
    depth: number;
    parent_id: string | null;
    path_slugs: string[] | null;
  }
  const rows = (data as unknown as Raw[] | null) ?? [];
  if (rows.length === 0) return [];

  /* One RPC per area would be an N+1. Ask the database to resolve them all in
     a single call instead. */
  const { data: allowed } = await supabase.rpc("areas_open_for_listings", {
    p_service: serviceSlug,
  });

  const open = new Set(
    ((allowed as { id: string }[]) ?? []).map((a) => a.id)
  );

  return rows
    .filter((r) => open.has(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      location_type: r.location_type,
      depth: r.depth,
      parent_id: r.parent_id,
      path: (r.path_slugs ?? []).join(" / "),
    }));
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
