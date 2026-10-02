import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { destinations as staticDestinations, type Destination } from "@/lib/data";
import { parseAttractions, type Attraction } from "@/lib/attractions";

/* ---- Row type (matches supabase/phase10-destinations.sql) ---- */

export interface DestinationRow {
  id: string;
  slug: string;
  name: string;
  location: string;
  stays: string | null;
  tagline: string | null;
  image: string | null;
  /** Added in supabase/phase65-destination-attractions.sql. */
  attractions?: unknown;
  created_at: string;
}

/** Map a database row to the shared Destination shape used by the UI. */
export function rowToDestination(r: DestinationRow): Destination {
  return {
    slug: r.slug,
    name: r.name,
    location: r.location,
    /* No default. "Stays available" was printed on destinations with none,
       and the stock-photo fallback put a random loremflickr image under a
       real place name. An empty image renders the honest no-photo tile. */
    stays: r.stays?.trim() || undefined,
    tagline: r.tagline ?? "",
    image: r.image ?? "",
    attractions: parseAttractions(r.attractions),
  };
}

/* THE PRESETS ARE NO LONGER PUBLISHED AUTOMATICALLY.
 *
 * A destination with no attractions used to be filled in from the ninety
 * suggestions in lib/attractions.ts, so a page nobody had edited still showed
 * a list — and that list read as Rego's own writing. It carried specific
 * claims: a fort's age, a pass's altitude, the height of a waterfall, the year
 * of a landslide. Nobody at Rego had checked any of them, and they went out
 * under Rego's name on a page a traveller might plan around.
 *
 * They are still one click away in the admin editor, which is the right place
 * for them: an admin loads them, reads them, corrects them and chooses to
 * save. A destination with nothing saved now shows no attractions section at
 * all, which is honest — there is nothing to say yet.
 */

/** Public destinations for the site. Falls back to the built-in list. */
export async function getDestinations(): Promise<Destination[]> {
  const fallbackAll = staticDestinations;
  if (!isSupabaseConfigured) return fallbackAll;
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .order("created_at", { ascending: true });
  if (error || !data || data.length === 0) return fallbackAll;
  return (data as DestinationRow[]).map(rowToDestination);
}

/** A single destination by slug, with static fallback. */
export async function getDestinationBySlug(
  slug: string
): Promise<Destination | null> {
  const fallback = staticDestinations.find((d) => d.slug === slug) ?? null;
  if (!isSupabaseConfigured) return fallback;

  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (data) return rowToDestination(data as DestinationRow);

  /* A read that actually failed is not the same as a destination that is not
     there. On an error, keep serving the built-in page rather than 404-ing a
     live URL because the database blinked. */
  if (error) return fallback;

  /* No row. The built-in list is only a starting point for an empty
     database — once there are destinations in it, the admin's list is the
     list, and a slug missing from it is missing on purpose. Without this, a
     destination deleted in the admin would keep serving from the code and
     could never be removed. */
  const { count } = await supabase
    .from("destinations")
    .select("id", { count: "exact", head: true });

  return count && count > 0 ? null : fallback;
}

/* ---------------- Admin operations ---------------- */

/** Raw rows (with ids) for the admin manager. */
export async function getDestinationRows(): Promise<DestinationRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getDestinationRows error:", error.message);
    return [];
  }
  return (data as DestinationRow[]) ?? [];
}

export interface DestinationInput {
  slug: string;
  name: string;
  location: string;
  stays?: string | null;
  tagline?: string | null;
  image?: string | null;
  attractions?: Attraction[];
}

/** Save just the attractions list for one destination. */
export async function updateDestinationAttractions(
  id: string,
  attractions: Attraction[]
) {
  return supabase.from("destinations").update({ attractions }).eq("id", id);
}

export async function createDestination(input: DestinationInput) {
  return supabase.from("destinations").insert(input).select().single();
}

export async function updateDestination(
  id: string,
  input: Partial<DestinationInput>
) {
  return supabase.from("destinations").update(input).eq("id", id);
}

export async function deleteDestination(id: string) {
  return supabase.from("destinations").delete().eq("id", id);
}

/** Turn a name into a URL-friendly slug, e.g. "Fairy Meadows" → "fairy-meadows". */
export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
