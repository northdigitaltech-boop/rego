import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { destinations as staticDestinations, type Destination } from "@/lib/data";

/* ---- Row type (matches supabase/phase10-destinations.sql) ---- */

export interface DestinationRow {
  id: string;
  slug: string;
  name: string;
  location: string;
  stays: string | null;
  tagline: string | null;
  image: string | null;
  created_at: string;
}

/** Map a database row to the shared Destination shape used by the UI. */
export function rowToDestination(r: DestinationRow): Destination {
  return {
    slug: r.slug,
    name: r.name,
    location: r.location,
    stays: r.stays ?? "Stays available",
    tagline: r.tagline ?? "",
    image: r.image ?? "https://loremflickr.com/1200/700/mountains,valley",
  };
}

/** Public destinations for the site. Falls back to the built-in list. */
export async function getDestinations(): Promise<Destination[]> {
  if (!isSupabaseConfigured) return staticDestinations;
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .order("created_at", { ascending: true });
  if (error || !data || data.length === 0) return staticDestinations;
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
  if (error || !data) return fallback;
  return rowToDestination(data as DestinationRow);
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
