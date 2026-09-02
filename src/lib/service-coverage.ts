import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Where a listing operates — service_locations (phase99).
 *
 * The one place in the app that knows this table exists. Every
 * form goes through here, so if the shape has to change there is
 * one file to change rather than twelve dashboards.
 *
 * NOTHING HERE IS AUTHORISATION.
 *   Writes go from the browser with the anon key. The gate is the
 *   RLS policy, which calls owns_listing() and compares the JWT
 *   email to owner_email on the listing's own table. What this
 *   file does is avoid sending writes that will be refused, and
 *   turn a refusal into a sentence rather than a Postgres error.
 * ============================================================ */

/** Must match the check constraint in phase99. */
export const COVERAGE_TABLES = [
  "hotels",
  "homestays",
  "hostels",
  "tour_companies",
  "tour_packages",
  "tour_guides",
  "transport_providers",
  "transport_services",
  "rental_vehicles",
  "media_providers",
  "media_services",
  "restaurants",
  "activities",
  "events",
  "coworking_spaces",
  "roadside_providers",
  "expedition_companies",
  "expedition_professionals",
] as const;

export type CoverageTable = (typeof COVERAGE_TABLES)[number];

export const RELATION_TYPES = [
  "base",
  "service_area",
  "destination",
  "pickup",
  "dropoff",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export interface CoverageRow {
  id: string;
  listing_table: string;
  listing_id: string;
  location_id: string;
  relation_type: string;
}

/**
 * Table names are checked here as well as in the database.
 *
 * The constraint is the real guard. This exists so a typo in a caller shows up
 * as "nothing was saved" during development rather than as a Postgres error
 * on a provider's screen in production.
 */
export function isCoverageTable(t: string): t is CoverageTable {
  return (COVERAGE_TABLES as readonly string[]).includes(t);
}

/** Every location this listing has declared, whatever the relation. */
export async function getCoverage(
  listingTable: string,
  listingId: string
): Promise<CoverageRow[]> {
  if (!isSupabaseConfigured || !listingId || !isCoverageTable(listingTable)) return [];

  const { data } = await supabase
    .from("service_locations")
    .select("id, listing_table, listing_id, location_id, relation_type")
    .eq("listing_table", listingTable)
    .eq("listing_id", listingId);

  return (data as CoverageRow[] | null) ?? [];
}

/** Just the location ids for one relation — what a picker needs. */
export async function getCoverageIds(
  listingTable: string,
  listingId: string,
  relation: RelationType = "service_area"
): Promise<string[]> {
  const rows = await getCoverage(listingTable, listingId);
  return rows.filter((r) => r.relation_type === relation).map((r) => r.location_id);
}

/**
 * What has to change to turn `current` into `wanted`, for one relation.
 *
 * Pure, and separate from setCoverage, because this is the part that can be
 * wrong in a way that loses a provider's data — and the rest of setCoverage
 * is two network calls that cannot be tested without a database.
 */
export function diffCoverage(
  current: CoverageRow[],
  wantedIds: string[],
  relation: RelationType
): { toAdd: string[]; toRemoveIds: string[] } {
  /* Only this relation is touched. A listing's `base` must survive a change to
     its `service_area`s — they answer different questions and are edited by
     different fields. */
  const mine = current.filter((r) => r.relation_type === relation);
  const have = new Set(mine.map((r) => r.location_id));

  // Duplicates in the input would otherwise become duplicate inserts, and the
  // unique constraint would reject the whole batch.
  const wanted = new Set(wantedIds.filter(Boolean));

  return {
    toAdd: [...wanted].filter((id) => !have.has(id)),
    toRemoveIds: mine.filter((r) => !wanted.has(r.location_id)).map((r) => r.id),
  };
}

/**
 * Make the stored coverage match `locationIds`, for one relation type.
 *
 * WHY THIS IS A DIFF AND NOT DELETE-THEN-INSERT
 *   Delete-all-then-insert-all is one line shorter and briefly leaves the
 *   listing covering nowhere. If the insert then fails — a dropped
 *   connection, a policy refusal, a provider closing the tab — the listing is
 *   left with no coverage at all, which is worse than the state it was in
 *   before they touched anything. Adding what is new and removing what is
 *   gone never passes through "covers nothing".
 *
 *   It also means a form saved twice writes nothing the second time.
 *
 * Returns an error message for the provider, or null.
 */
export async function setCoverage(
  listingTable: string,
  listingId: string,
  locationIds: string[],
  relation: RelationType = "service_area"
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  if (!listingId) return null;
  if (!isCoverageTable(listingTable)) return null;

  const current = await getCoverage(listingTable, listingId);
  const { toAdd, toRemoveIds } = diffCoverage(current, locationIds, relation);

  if (toAdd.length > 0) {
    const { error } = await supabase.from("service_locations").insert(
      toAdd.map((location_id) => ({
        listing_table: listingTable,
        listing_id: listingId,
        location_id,
        relation_type: relation,
      }))
    );
    if (error) return coverageError(error.message);
  }

  if (toRemoveIds.length > 0) {
    const { error } = await supabase
      .from("service_locations")
      .delete()
      .in("id", toRemoveIds);
    if (error) return coverageError(error.message);
  }

  return null;
}

/**
 * Remove every coverage row for a listing.
 *
 * Call this when a listing is deleted. service_locations has no foreign key
 * to the listing — it cannot have one, because the table name is a column —
 * so nothing cleans up automatically. A left-behind row is inert rather than
 * harmful, but "inert rubbish accumulates until someone counts it" is how a
 * count of who serves Skardu quietly becomes wrong.
 */
export async function clearCoverage(
  listingTable: string,
  listingId: string
): Promise<void> {
  if (!isSupabaseConfigured || !listingId || !isCoverageTable(listingTable)) return;
  await supabase
    .from("service_locations")
    .delete()
    .eq("listing_table", listingTable)
    .eq("listing_id", listingId);
}

/**
 * Which listings in a table serve a location.
 *
 * The query traveller search will need. Returns ids only, to be intersected
 * with whatever the caller already has — deliberately not a join, so this can
 * be added to an existing search without changing how that search loads its
 * listings.
 */
export async function listingIdsServing(
  listingTable: string,
  locationId: string,
  relation: RelationType = "service_area"
): Promise<string[]> {
  if (!isSupabaseConfigured || !locationId || !isCoverageTable(listingTable)) return [];

  const { data } = await supabase
    .from("service_locations")
    .select("listing_id")
    .eq("listing_table", listingTable)
    .eq("location_id", locationId)
    .eq("relation_type", relation);

  return ((data as { listing_id: string }[] | null) ?? []).map((r) => r.listing_id);
}

/**
 * Turn a Postgres refusal into something a provider can act on.
 *
 * The RLS policy refuses silently — Postgres reports a policy violation, not
 * "that is not your listing" — and showing that raw makes a deliberate rule
 * look like a crash.
 */
function coverageError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("row-level security") || m.includes("violates row-level")) {
    return "Those service areas could not be saved against this listing. Please make sure you are signed in as its owner.";
  }
  if (m.includes("duplicate key")) {
    // Two saves racing. The row exists, which is the outcome that was wanted.
    return "";
  }
  if (m.includes("violates foreign key") || m.includes("violates check")) {
    return "One of those areas is no longer available. Please choose them again.";
  }
  return "Your service areas could not be saved. The rest of your listing was.";
}
