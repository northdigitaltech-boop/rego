import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * The real place tree, for forms that should offer a choice
 * rather than an empty box.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT area-rules.ts
 *
 * getSubmittableAreas() answers a PROVIDER's question: "where
 * am I allowed to list?" It filters to areas currently open for
 * one service, which is exactly right on a listing form and
 * exactly wrong on an admin one. A road alert for a district
 * that is closed to new hotels is still a road alert, and an
 * admin who cannot pin it has been blocked by a rule that was
 * never about them.
 *
 * So this walks the whole tree. The gate on an admin form is
 * who is signed in, not which markets are taking listings.
 * ---------------------------------------------------------------------------
 *
 * THREE LEVELS, NAMED BY TYPE — NOT BY DEPTH
 *   Region → District → City / Area. Chosen by location_type
 *   rather than by how deep a row sits, because the tree is not
 *   uniform: Gilgit-Baltistan has divisions between region and
 *   district, and a country entered later may not. Reading depth
 *   would put "Baltistan Division" on the District dropdown,
 *   which is not a district and is not what anyone means.
 *
 *   Divisions are skipped rather than shown. Nobody files a
 *   hotel, a pin or a job under a division.
 *
 * THE NAMES ARE THE ANSWER
 *   These forms store text columns — map_places.district is a
 *   text field and a hundred rows already use it. Returning names
 *   means the picker drops into the existing schema without a
 *   migration and without touching what is already saved. The id
 *   is handed over too, for any caller that wants to store it.
 * ============================================================ */

export interface PlaceNode {
  id: string;
  name: string;
  location_type: string;
  parent_id: string | null;
}

/** Types offered on the District dropdown. */
const DISTRICT_TYPES = new Set(["district"]);

/**
 * Types offered on the City / Area dropdown.
 *
 * Attractions and landmarks are deliberately in: a map pin for a hotel near
 * Attabad Lake is genuinely located at Attabad Lake, and the alternative is an
 * admin typing it by hand into a field this exists to stop them typing into.
 */
const PLACE_TYPES = new Set(["city", "town", "area", "village", "attraction", "landmark"]);

/* Held for the tab. Several of these dropdowns can be on screen at once — the
   pin form alone has three — and the tree does not change while a form is
   open. */
let cache: PlaceNode[] | null = null;
let inFlight: Promise<PlaceNode[]> | null = null;

/**
 * Every location, flat, with parent links intact.
 *
 * Returns [] rather than throwing on any failure. A form that cannot read the
 * tree must fall back to a text box, not break — see LocationSelect, which does
 * exactly that.
 */
export async function loadPlaceTree(): Promise<PlaceNode[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  if (!isSupabaseConfigured) return [];

  inFlight = (async () => {
    try {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, location_type, parent_id")
        .order("display_order")
        .limit(2000);

      if (error) {
        /* Cleared so a later mount can retry. A read that failed because the
           session was still settling should not poison the whole tab. */
        inFlight = null;
        return [];
      }

      const rows = ((data as PlaceNode[] | null) ?? []).filter(
        (r) => r.id && r.name?.trim()
      );
      cache = rows;
      inFlight = null;
      return rows;
    } catch {
      inFlight = null;
      return [];
    }
  })();

  return inFlight;
}

/** Forget the cached tree — call after adding a location in the admin. */
export function invalidatePlaceTree(): void {
  cache = null;
  inFlight = null;
}

/* ------------------------------------------------------------------ */
/* Pure walking helpers — everything below is testable without a DB.    */
/* ------------------------------------------------------------------ */

/** Regions, alphabetical. The top of every cascade. */
export function regionsOf(tree: PlaceNode[]): PlaceNode[] {
  return byName(tree.filter((n) => n.location_type === "region"));
}

/**
 * Whether `nodeId` sits anywhere beneath `ancestorId`.
 *
 * Walks parent links rather than trusting the stored `ancestors` array,
 * because a row can be re-parented by an admin and this must agree with what
 * the dropdown above it is showing right now. Bounded by the tree size: the
 * database rejects cycles, but a loop over data it did not create is a loop
 * that can hang a form.
 */
export function isDescendantOf(
  tree: PlaceNode[],
  nodeId: string,
  ancestorId: string
): boolean {
  const byId = new Map(tree.map((n) => [n.id, n]));
  let cursor = byId.get(nodeId)?.parent_id ?? null;
  for (let guard = 0; cursor && guard <= tree.length; guard++) {
    if (cursor === ancestorId) return true;
    cursor = byId.get(cursor)?.parent_id ?? null;
  }
  return false;
}

/**
 * Districts inside one region.
 *
 * Descendants, not children — Gilgit-Baltistan's districts hang off divisions,
 * so asking for direct children would return divisions and no districts at all.
 *
 * With no region chosen, every district is offered. That is on purpose: an
 * admin who knows the district but not which division it belongs to should not
 * have to work it out to get past the first dropdown.
 */
export function districtsOf(tree: PlaceNode[], regionId: string | null): PlaceNode[] {
  const all = tree.filter((n) => DISTRICT_TYPES.has(n.location_type));
  if (!regionId) return byName(all);
  return byName(all.filter((n) => isDescendantOf(tree, n.id, regionId)));
}

/**
 * Cities, areas, villages and attractions inside one district.
 *
 * Empty when no district is chosen. Unlike districts, the full list here runs
 * to hundreds of rows across the whole province — a dropdown nobody can use,
 * and the reason the district above it exists.
 */
export function placesOf(tree: PlaceNode[], districtId: string | null): PlaceNode[] {
  if (!districtId) return [];
  return byName(
    tree.filter(
      (n) => PLACE_TYPES.has(n.location_type) && isDescendantOf(tree, n.id, districtId)
    )
  );
}

/**
 * The region a district belongs to, if any.
 *
 * Used to set the Region dropdown when a form opens holding a saved district
 * and nothing else — which is every map pin created before this picker existed.
 */
export function regionOfDistrict(
  tree: PlaceNode[],
  districtId: string | null
): PlaceNode | null {
  if (!districtId) return null;
  return regionsOf(tree).find((r) => isDescendantOf(tree, districtId, r.id)) ?? null;
}

/**
 * Find a node by name at one level, case-insensitively.
 *
 * The bridge between the text already in the database and the ids the
 * dropdowns run on. "skardu", "Skardu" and "SKARDU" are one district, which is
 * the whole reason these columns needed a picker.
 *
 * Returns null on no match — a saved value that no longer exists in the tree
 * is shown as typed rather than silently dropped.
 */
export function findByName(options: PlaceNode[], name: string | null): PlaceNode | null {
  const q = name?.trim().toLowerCase();
  if (!q) return null;
  return options.find((o) => o.name.trim().toLowerCase() === q) ?? null;
}

/** The two location types that describe a place a traveller goes to see. */
const SPOT_TYPES = new Set(["attraction", "landmark"]);

/**
 * Tourist spots for one destination, from Area Management.
 *
 * The attractions editor used to be a free-text box with a list of
 * hard-coded suggestions. Everything it produced was typed by hand, so
 * "Shangrila Lake", "Shangri-La Lake" and "shangrila lake" could all
 * end up published as different spots — and none of them matched the
 * locations an admin had already curated in Area Management.
 *
 * This is the other direction from markets.syncAttractions(), which
 * copies a destination's attractions INTO the tree. Both now exist, so
 * whichever side an admin works on, the other can be filled from it.
 *
 * `destinationName` is matched against the tree by name, because that
 * is the only link a destinations row has to a location — it carries a
 * slug and a display name, not a location_id. When no such place is in
 * the tree, every spot is returned rather than none: an admin whose
 * destination has not been added to Area Management yet should still
 * get a list to pick from, not an empty box with no explanation.
 */
export function spotsForDestination(
  tree: PlaceNode[],
  destinationName: string | null
): PlaceNode[] {
  const spots = tree.filter((n) => SPOT_TYPES.has(n.location_type));
  const here = findByName(tree, destinationName);
  if (!here) return byName(spots);

  const inside = spots.filter((n) => isDescendantOf(tree, n.id, here.id));
  /* A destination with nothing beneath it yet falls back to the whole
     list for the same reason as above — an empty picker looks broken. */
  return byName(inside.length > 0 ? inside : spots);
}

function byName(nodes: PlaceNode[]): PlaceNode[] {
  return [...nodes].sort((a, b) => a.name.localeCompare(b.name));
}
