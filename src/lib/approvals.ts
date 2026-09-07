import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * The approval queue, read across every listing table.
 *
 * WHY THIS EXISTS ALONGSIDE THE ADMIN DASHBOARD'S OWN FETCHING
 *   admin-dashboard.tsx already loads pending rows — in about forty pieces of
 *   component state, inside a 2,600-line file. Threading that into the portal
 *   would have meant editing the one screen this project can least afford to
 *   break, for no behavioural gain.
 *
 *   So this is a second READER. It is deliberately NOT a second source of
 *   truth: both read the same rows and write the same column, and the
 *   decision itself is enforced in one place — the phase111 trigger. If the
 *   two screens ever disagree it will be about what is displayed, never about
 *   what is true.
 *
 * NOTHING HERE IS AUTHORISATION
 *   A reviewer sees these rows because phase111 added a policy letting staff
 *   with approve_listing or reject_listing read them, scoped to their area.
 *   Somebody without the permission gets an empty list from Postgres, not
 *   from this file.
 * ============================================================ */

export interface PendingListing {
  /** The table it came from. Needed to write the decision back. */
  table: string;
  /** What a person calls this kind of thing. */
  kind: string;
  id: string;
  title: string;
  ownerEmail: string | null;
  locationId: string | null;
  image: string | null;
  createdAt: string | null;
}

/* One row per listing table: where its name lives, and what to call it.
   Column names genuinely differ — hotels has `title`, transport_providers has
   `name`, roadside_providers has `business_name` — so this map is read from
   the schema rather than guessed, and it is the only place that knowledge
   sits. */
const TABLES: {
  table: string;
  kind: string;
  titleCol: string;
  imageCol?: string;
}[] = [
  { table: "hotels", kind: "Hotel", titleCol: "title", imageCol: "image" },
  { table: "homestays", kind: "Homestay", titleCol: "title", imageCol: "image" },
  { table: "hostels", kind: "Hostel", titleCol: "title", imageCol: "image" },
  { table: "tour_companies", kind: "Tour company", titleCol: "name", imageCol: "logo" },
  { table: "tour_packages", kind: "Tour package", titleCol: "title", imageCol: "image" },
  { table: "tour_guides", kind: "Guide", titleCol: "name", imageCol: "image" },
  { table: "transport_providers", kind: "Transport company", titleCol: "name", imageCol: "logo" },
  { table: "rental_vehicles", kind: "Rental vehicle", titleCol: "title", imageCol: "image" },
  { table: "media_providers", kind: "Photographer / media", titleCol: "company_name", imageCol: "logo" },
  { table: "restaurants", kind: "Restaurant", titleCol: "name", imageCol: "image" },
  { table: "coworking_spaces", kind: "Co-working space", titleCol: "name", imageCol: "logo" },
  { table: "roadside_providers", kind: "Roadside assistance", titleCol: "business_name" },
  { table: "expedition_companies", kind: "Expedition company", titleCol: "name", imageCol: "logo" },
];

/**
 * Everything waiting for a decision that the caller is allowed to see.
 *
 * Queries run in parallel and a failing table is SKIPPED rather than failing
 * the whole queue: a deployment missing one table, or a column renamed, should
 * cost that one section and not the reviewer's whole screen.
 */
export async function loadPendingApprovals(): Promise<PendingListing[]> {
  if (!isSupabaseConfigured) return [];

  const results = await Promise.all(
    TABLES.map(async (t) => {
      const cols = [
        "id",
        `${t.titleCol}`,
        "owner_email",
        "location_id",
        "created_at",
        ...(t.imageCol ? [t.imageCol] : []),
      ].join(", ");

      const { data, error } = await supabase
        .from(t.table)
        .select(cols)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(100);

      if (error || !data) return [];

      return (data as unknown as Record<string, unknown>[]).map((row) => ({
        table: t.table,
        kind: t.kind,
        id: String(row.id),
        title: String(row[t.titleCol] ?? "Untitled"),
        ownerEmail: (row.owner_email as string | null) ?? null,
        locationId: (row.location_id as string | null) ?? null,
        image: t.imageCol ? ((row[t.imageCol] as string | null) ?? null) : null,
        createdAt: (row.created_at as string | null) ?? null,
      }));
    })
  );

  /* Oldest first across the whole queue, not per table. Somebody waiting nine
     days should not sit behind a table that happens to sort earlier. */
  return results
    .flat()
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

export type Decision = "approved" | "rejected";

/**
 * Approve or reject.
 *
 * The write is an ordinary UPDATE. What makes it safe is not this function —
 * it is the phase111 trigger, which refuses a status change from anybody who
 * is not an admin or staff holding the right permission for that listing's
 * area. So a forged call from a console fails in Postgres, not here.
 */
export async function decideListing(
  table: string,
  id: string,
  decision: Decision
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not configured." };

  /* The table name reaches PostgREST as a path segment, so it is checked
     against the list this file already knows rather than passed through. */
  if (!TABLES.some((t) => t.table === table)) {
    return { ok: false, error: "Unknown listing type." };
  }

  const { error } = await supabase
    .from(table)
    .update({ status: decision })
    .eq("id", id);

  if (error) {
    /* The trigger's own message is written for a person and says who decides,
       so it is passed through rather than replaced with something vaguer. */
    if (/status is set by the Rego team|Verified and Featured/i.test(error.message)) {
      return { ok: false, error: error.message };
    }
    if (/row-level security/i.test(error.message)) {
      return {
        ok: false,
        error: "That listing is outside the area you cover.",
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
