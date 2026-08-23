import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Location SEO — server-side reads and the indexability gate.
 *
 * ---------------------------------------------------------------------------
 * THE GATE IS THE POINT OF THIS FILE.
 *
 * A location tree makes it trivial to generate a page for every
 * area crossed with every service. Thirteen districts times
 * fourteen services is 182 pages, most of them empty. Google
 * treats that as doorway spam, and the damage lands on the
 * domain, not just the thin pages.
 *
 * So: one function decides whether a page may be indexed, and
 * BOTH the page and the sitemap call it. Two implementations
 * would eventually disagree, and a sitemap that lists pages the
 * page itself marks noindex is a crawl-budget leak that nobody
 * notices for months.
 * ---------------------------------------------------------------------------
 */

/** A page needs at least this many real listings to earn indexing on its own. */
const MIN_LISTINGS_TO_INDEX = 3;

/** Or this much genuinely unique prose, if listings are still thin. */
const MIN_CONTENT_CHARS = 300;

export interface LocationSeoRow {
  location_id: string;
  service_slug: string | null;
  language_code: string;
  seo_title: string | null;
  meta_description: string | null;
  h1: string | null;
  intro: string | null;
  body: string | null;
  focus_keyword: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  hero_image: string | null;
  hero_image_alt: string | null;
  faq: { q: string; a: string }[];
  robots_index: boolean;
  robots_follow: boolean;
  content_updated_at: string | null;
}

export interface PublicLocation {
  id: string;
  name: string;
  slug: string;
  location_type: string;
  path_slugs: string[];
  latitude: number | null;
  longitude: number | null;
  coming_soon_message: string | null;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/** Public locations only — RLS already enforces this, belt and braces. */
export async function getPublicLocationBySlug(
  slug: string
): Promise<PublicLocation | null> {
  if (!isSupabaseConfigured || !slug) return null;
  const { data } = await supabase
    .from("locations")
    .select("id, name, slug, location_type, path_slugs, latitude, longitude, coming_soon_message")
    .eq("slug", slug)
    .maybeSingle();
  return (data as PublicLocation) ?? null;
}

export async function getLocationSeo(
  locationId: string,
  serviceSlug: string | null = null,
  language = "en"
): Promise<LocationSeoRow | null> {
  if (!isSupabaseConfigured || !locationId) return null;

  let q = supabase
    .from("location_seo")
    .select("*")
    .eq("location_id", locationId)
    .eq("language_code", language);

  // `is null` and `eq` are different queries — a destination page and a
  // location+service page are separate rows.
  q = serviceSlug ? q.eq("service_slug", serviceSlug) : q.is("service_slug", null);

  const { data } = await q.maybeSingle();
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    ...(row as unknown as LocationSeoRow),
    faq: Array.isArray(row.faq) ? (row.faq as { q: string; a: string }[]) : [],
  };
}

/** Admin-curated, not computed from distance — see the phase72 comment. */
export async function getNearbyLocations(
  locationId: string
): Promise<PublicLocation[]> {
  if (!isSupabaseConfigured || !locationId) return [];
  const { data } = await supabase
    .from("location_nearby")
    .select("nearby_id, display_order, locations!location_nearby_nearby_id_fkey(id, name, slug, location_type, path_slugs, latitude, longitude, coming_soon_message)")
    .eq("location_id", locationId)
    .order("display_order");

  const rows = (data as unknown as { locations: PublicLocation | null }[]) ?? [];
  return rows.map((r) => r.locations).filter((l): l is PublicLocation => Boolean(l));
}

/** Services actually open in this area, in display order. */
export async function getOpenServices(
  locationId: string
): Promise<{ slug: string; name: string }[]> {
  if (!isSupabaseConfigured || !locationId) return [];
  const { data } = await supabase.rpc("services_open_at_location", {
    p_location_id: locationId,
  });
  return ((data as { slug: string; name: string }[]) ?? []);
}

/** How many public listings sit in this area (and its sub-areas). */
export async function countListingsAt(
  locationIds: string[],
  tables: string[] = [
    "hotels",
    "homestays",
    "hostels",
    "restaurants",
    "activities",
    "tour_companies",
    "tour_guides",
    "transport_providers",
    "media_providers",
    "coworking_spaces",
  ]
): Promise<number> {
  if (!isSupabaseConfigured || locationIds.length === 0) return 0;

  const counts = await Promise.all(
    tables.map(async (t) => {
      const { count } = await supabase
        .from(t)
        .select("id", { count: "exact", head: true })
        .in("location_id", locationIds)
        .eq("status", "approved");
      return count ?? 0;
    })
  );
  return counts.reduce((a, b) => a + b, 0);
}

/* ------------------------------------------------------------------ */
/* The gate                                                            */
/* ------------------------------------------------------------------ */

export interface IndexDecision {
  index: boolean;
  /** Plain-language reason. Shown in the admin so the rule is auditable. */
  reason: string;
}

/**
 * May this page be indexed and appear in the sitemap?
 *
 * Every condition must hold. They are checked in the order that fails
 * cheapest, and the reason names the first failure so an admin asking
 * "why isn't this page indexed" gets an answer rather than a guess.
 */
export function decideIndexable(input: {
  locationIsPublic: boolean;
  locationIsActive: boolean;
  seoEnabled: boolean;
  serviceAvailable: boolean;
  comingSoon: boolean;
  robotsIndex: boolean;
  listingCount: number;
  contentChars: number;
}): IndexDecision {
  if (!input.locationIsActive) {
    return { index: false, reason: "The area is not active." };
  }
  if (!input.locationIsPublic) {
    return { index: false, reason: "The area is not visible on the website." };
  }
  if (!input.seoEnabled) {
    return { index: false, reason: "SEO is switched off for this area." };
  }
  if (!input.serviceAvailable) {
    return { index: false, reason: "This service is not available in this area." };
  }
  if (!input.robotsIndex) {
    return { index: false, reason: "Set to noindex in the SEO tab." };
  }

  /* Coming Soon does NOT earn indexing by itself. The brief is explicit:
     allow indexing only when the page has genuinely useful content. A
     placeholder that says "coming soon" is the definition of a thin page. */
  if (input.comingSoon && input.contentChars < MIN_CONTENT_CHARS) {
    return {
      index: false,
      reason: `Marked coming soon and has less than ${MIN_CONTENT_CHARS} characters of written content.`,
    };
  }

  if (
    input.listingCount < MIN_LISTINGS_TO_INDEX &&
    input.contentChars < MIN_CONTENT_CHARS
  ) {
    return {
      index: false,
      reason: `Thin page — ${input.listingCount} listing${input.listingCount === 1 ? "" : "s"} and ${input.contentChars} characters of content. Needs ${MIN_LISTINGS_TO_INDEX} listings or ${MIN_CONTENT_CHARS} characters.`,
    };
  }

  return { index: true, reason: "Indexable." };
}

/**
 * Characters of genuinely unique prose on a page.
 *
 * Takes only the three fields it measures, so the admin editor can pass an
 * unsaved draft and the public page can pass a saved row — both without a
 * cast. Titles and meta descriptions are excluded on purpose: they are
 * metadata, not content a visitor reads on the page.
 */
export function contentLength(
  seo: Pick<LocationSeoRow, "intro" | "body" | "faq"> | null
): number {
  if (!seo) return 0;
  const faq = Array.isArray(seo.faq) ? seo.faq : [];
  const parts = [seo.intro, seo.body, ...faq.map((f) => `${f.q} ${f.a}`)];
  return parts.filter(Boolean).join(" ").trim().length;
}

/* ------------------------------------------------------------------ */
/* URLs                                                                */
/* ------------------------------------------------------------------ */

/**
 * Canonical path for a location page.
 *
 * Deliberately keeps /destinations/<slug>, the URL that is already indexed.
 * A hierarchical path like /pk/gilgit-baltistan/skardu would be tidier and
 * would also drop every existing destination page out of the index in
 * exchange for tidiness. Not worth it.
 */
export function locationPath(slug: string, service?: string | null): string {
  return service ? `/destinations/${slug}/${service}` : `/destinations/${slug}`;
}
