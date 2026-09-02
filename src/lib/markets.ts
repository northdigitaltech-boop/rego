import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Market & Area Management — client data layer.
 *
 * READS go through the anon key and are governed by the RLS in
 * phase72: an admin session sees the whole tree, anyone else
 * sees only what is explicitly public.
 *
 * WRITES do NOT happen here. Every change goes through
 * /api/admin/markets, which verifies the caller is an admin
 * server-side and writes an audit row. A write path in the
 * browser could be called directly from a console, and these
 * settings decide whether an area takes bookings.
 * ============================================================ */

/** Controls that use three-state inheritance. NULL means "inherit". */
export const AREA_FLAGS = [
  "is_active",
  "is_public",
  "onboarding_enabled",
  "listings_enabled",
  "booking_enabled",
  "manual_approval_required",
  "coming_soon",
  "is_featured",
  "seo_enabled",
] as const;

export type AreaFlag = (typeof AREA_FLAGS)[number];

/** The subset that can also be set per service within an area. */
export const SERVICE_FLAGS = [
  "listings_enabled",
  "booking_enabled",
  "onboarding_enabled",
  "manual_approval_required",
  "coming_soon",
  "seo_enabled",
] as const;

export type ServiceFlag = (typeof SERVICE_FLAGS)[number];

export const FLAG_LABELS: Record<AreaFlag, string> = {
  is_active: "Active",
  is_public: "Visible on website",
  onboarding_enabled: "Provider registration",
  listings_enabled: "New listings",
  booking_enabled: "Bookings",
  manual_approval_required: "Manual approval required",
  coming_soon: "Coming soon",
  is_featured: "Featured destination",
  seo_enabled: "SEO / indexable",
};

/** What each control actually does, in plain words, for the admin UI. */
export const FLAG_HELP: Record<AreaFlag, string> = {
  is_active:
    "Master switch. Turning this off hides the area everywhere and stops all activity in it.",
  is_public:
    "Whether travellers can see this area on the website. Separate from SEO — an area can be visible without being indexed.",
  onboarding_enabled:
    "Whether new providers may register against this area. Existing providers are unaffected.",
  listings_enabled:
    "Whether new listings may be submitted. Existing listings stay stored and keep working either way.",
  booking_enabled:
    "Whether new bookings may be taken. Confirmed bookings are never affected by this.",
  manual_approval_required:
    "New listings here wait for admin approval instead of going live.",
  coming_soon:
    "Shows the coming-soon message instead of listings. Does not make the page indexable on its own.",
  is_featured: "Promotes the area on destination rails and the homepage.",
  seo_enabled:
    "Allows the page into the sitemap and permits indexing — only if it also has real content.",
};

/* ============================================================
 * Which of these switches actually DO something today.
 *
 * WHY THIS EXISTS
 *   Every flag reads and saves. Only some of them are consumed
 *   by anything. An admin who turns off "Bookings" for an area
 *   and expects bookings to stop would be wrong, and nothing on
 *   the screen told them so. That is worse than not offering the
 *   switch: it is a control that lies.
 *
 *   This is checked against the code, not assumed. If you wire a
 *   flag up, change its entry here in the same commit.
 * ============================================================ */
export type FlagStatus = "live" | "stored";

export const FLAG_STATUS: Record<AreaFlag, FlagStatus> = {
  is_active: "live",
  is_public: "live",
  listings_enabled: "live",
  seo_enabled: "live",
  coming_soon: "live",
  onboarding_enabled: "stored",
  booking_enabled: "stored",
  manual_approval_required: "stored",
  is_featured: "stored",
};

/** Where a live flag takes effect, so the badge can say something useful. */
export const FLAG_EFFECT: Partial<Record<AreaFlag, string>> = {
  is_active:
    "Used by the area list in provider forms, and by the sitemap and indexing decisions.",
  is_public:
    "Two separate gates. Travellers can only read a location whose own is_public is explicitly true — see the note about inheritance. Also used by provider forms, the sitemap and indexing.",
  listings_enabled:
    "Used by the area list in provider registration and listing forms, per service.",
  seo_enabled: "Used by the sitemap and by per-service destination pages.",
  coming_soon: "Used by the sitemap and by per-service destination pages.",
};

/** Why a stored flag is not live yet, so nobody has to go and find out. */
export const FLAG_NOT_YET: Partial<Record<AreaFlag, string>> = {
  onboarding_enabled:
    "Saved, but nothing reads it. Provider registration is gated by New listings instead.",
  booking_enabled:
    "Saved, but nothing reads it. Turning this off does NOT stop bookings being taken in this area.",
  manual_approval_required:
    "Saved, but nothing reads it. Listings here still follow the normal approval rules.",
  is_featured:
    "Saved, but no public rail or homepage section reads it yet.",
};

/* ------------------------------------------------------------------
 * The trap that catches everyone once.
 *
 * There are two different meanings of "public" in this system, and
 * they disagree on purpose:
 *
 *   • resolve_location_flag() INHERITS. A NULL on Skardu resolves to
 *     whatever Gilgit-Baltistan says. This is what the provider form
 *     list and the enforcement trigger use.
 *
 *   • The row-level security read policy does NOT inherit. It is
 *     `is_public is true` on the row itself, because an undecided
 *     location must not leak to the public site through a bug in a
 *     recursive resolver. That is the right call for a security
 *     boundary.
 *
 * The consequence is not obvious and is not written down anywhere
 * else: setting Gilgit-Baltistan public does NOT make Skardu
 * readable by a traveller. Each location a traveller should reach
 * needs its own explicit Visible-on-website = On.
 * ------------------------------------------------------------------ */
export const PUBLIC_IS_NOT_INHERITED =
  "Travellers can only load a location that is explicitly set to On here. " +
  "Unlike the other switches, Visible on website does not inherit for reading: " +
  "turning it on for a region does not turn it on for the districts inside it. " +
  "Set it on each area you want travellers to reach.";

export type FlagOrigin = "override_service" | "override_location" | "inherited";

export interface LocationRow {
  id: string;
  market_id: string;
  parent_id: string | null;
  location_type: string;
  name: string;
  slug: string;
  country_code: string;
  currency_code: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  display_order: number;
  depth: number;
  ancestors: string[];
  path_slugs: string[];
  coming_soon_message: string | null;
  created_at: string;
  updated_at: string;

  is_active: boolean | null;
  is_public: boolean | null;
  onboarding_enabled: boolean | null;
  listings_enabled: boolean | null;
  booking_enabled: boolean | null;
  manual_approval_required: boolean | null;
  coming_soon: boolean | null;
  is_featured: boolean | null;
  seo_enabled: boolean | null;
}

export interface MarketRow {
  id: string;
  slug: string;
  name: string;
  country_code: string;
  currency_code: string;
  timezone: string;
  default_language: string;
  is_active: boolean;
  is_public: boolean;
  display_order: number;
}

export interface ServiceCategoryRow {
  slug: string;
  name: string;
  group_label: string | null;
  is_active: boolean;
  display_order: number;
}

export interface LocationServiceRow {
  id: string;
  location_id: string;
  service_slug: string;
  listings_enabled: boolean | null;
  booking_enabled: boolean | null;
  onboarding_enabled: boolean | null;
  manual_approval_required: boolean | null;
  coming_soon: boolean | null;
  seo_enabled: boolean | null;
  display_order: number;
  updated_at: string;
}

export interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function getMarkets(): Promise<MarketRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("markets")
    .select("*")
    .order("display_order");
  return (data as MarketRow[]) ?? [];
}

/**
 * Whole tree for one market.
 *
 * Deliberately one query for the market rather than one per node — the
 * hierarchy is small enough to hold in memory and the alternative is a
 * request per expand, which is the N+1 the brief warns about. It is scoped
 * to a market so opening Pakistan never loads a future second country.
 */
export async function getLocations(marketId: string): Promise<LocationRow[]> {
  if (!isSupabaseConfigured || !marketId) return [];
  const { data } = await supabase
    .from("locations")
    .select("*")
    .eq("market_id", marketId)
    .order("display_order");

  const rows = (data as LocationRow[]) ?? [];
  // Sort by path so the list is already in tree order — no client-side
  // recursion needed to render it.
  return rows.sort((a, b) =>
    (a.path_slugs ?? []).join("/").localeCompare((b.path_slugs ?? []).join("/"))
  );
}

export async function getServiceCategories(): Promise<ServiceCategoryRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  return (data as ServiceCategoryRow[]) ?? [];
}

export async function getLocationServices(
  locationId: string
): Promise<LocationServiceRow[]> {
  if (!isSupabaseConfigured || !locationId) return [];
  const { data } = await supabase
    .from("location_service_settings")
    .select("*")
    .eq("location_id", locationId);
  return (data as LocationServiceRow[]) ?? [];
}

export async function getAuditLog(
  entityId?: string,
  limit = 50
): Promise<AuditRow[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase
    .from("market_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (entityId) q = q.eq("entity_id", entityId);
  const { data } = await q;
  return (data as AuditRow[]) ?? [];
}

/**
 * How many listings sit in an area, per table.
 *
 * Counts only, never rows — the admin needs the number, and pulling the
 * records to length them would be slow and pointless.
 *
 * IMPORTANT: this counts rows whose location_id has been backfilled. Until
 * phase75 has run, these will read zero even where listings exist. The UI
 * must say so rather than implying the area is empty.
 */
export async function getLocationCounts(
  locationId: string,
  includeDescendants: string[] = []
): Promise<{ total: number; byTable: Record<string, number> }> {
  if (!isSupabaseConfigured || !locationId) return { total: 0, byTable: {} };

  const ids = [locationId, ...includeDescendants];
  const tables = [
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
  ];

  const byTable: Record<string, number> = {};
  let total = 0;

  const results = await Promise.all(
    tables.map(async (t) => {
      const { count } = await supabase
        .from(t)
        .select("id", { count: "exact", head: true })
        .in("location_id", ids);
      return [t, count ?? 0] as const;
    })
  );

  for (const [t, n] of results) {
    if (n > 0) byTable[t] = n;
    total += n;
  }
  return { total, byTable };
}

/* ------------------------------------------------------------------ */
/* Inheritance — resolved in the browser for display only              */
/* ------------------------------------------------------------------ */

/**
 * Mirror of public.resolve_location_flag, for rendering.
 *
 * THIS IS NOT AUTHORISATION. It exists so the admin can see the resolved
 * value beside the local one without a round trip per row. Every decision
 * that matters is re-resolved in the database, because a value computed in
 * a browser can be changed in a browser.
 *
 * Precedence, most specific first:
 *   1. explicit service setting here
 *   2. explicit location setting here
 *   3. the same, walking up the ancestors
 *   4. safe default — false, except is_active / is_public
 */
export function resolveFlag(
  location: LocationRow,
  flag: AreaFlag,
  all: LocationRow[],
  serviceSettings?: Map<string, LocationServiceRow>,
  serviceSlug?: string
): { value: boolean; origin: FlagOrigin } {
  const byId = new Map(all.map((l) => [l.id, l]));
  // Self first, then ancestors nearest-first.
  const chain = [location, ...[...(location.ancestors ?? [])].reverse()
    .map((id) => byId.get(id))
    .filter((l): l is LocationRow => Boolean(l))];

  for (let i = 0; i < chain.length; i++) {
    const node = chain[i];

    if (serviceSlug && serviceSettings && (SERVICE_FLAGS as readonly string[]).includes(flag)) {
      const s = serviceSettings.get(`${node.id}:${serviceSlug}`);
      const v = s?.[flag as ServiceFlag];
      if (v !== null && v !== undefined) {
        return { value: v, origin: i === 0 ? "override_service" : "inherited" };
      }
    }

    const v = node[flag];
    if (v !== null && v !== undefined) {
      return { value: v, origin: i === 0 ? "override_location" : "inherited" };
    }
  }

  return {
    value: flag === "is_active" || flag === "is_public",
    origin: "inherited",
  };
}

/** Direct children of a node, in display order. */
export function childrenOf(all: LocationRow[], parentId: string | null) {
  return all
    .filter((l) => l.parent_id === parentId)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
}

/** Every descendant id — used for roll-up counts and "apply to children". */
export function descendantIds(all: LocationRow[], id: string): string[] {
  return all.filter((l) => (l.ancestors ?? []).includes(id)).map((l) => l.id);
}

/* ------------------------------------------------------------------ */
/* Writes — all through the server                                     */
/* ------------------------------------------------------------------ */

export interface MarketApiResult {
  ok: boolean;
  error?: string;
}

async function post(body: unknown): Promise<MarketApiResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "Please sign in again." };

    const res = await fetch("/api/admin/markets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as MarketApiResult;
    if (!res.ok) {
      return { ok: false, error: json.error || `Server returned ${res.status}.` };
    }
    return json;
  } catch {
    return { ok: false, error: "Network error. Nothing was changed." };
  }
}

export interface SyncAttractionsResult extends MarketApiResult {
  added?: number;
  restored?: number;
  deactivated?: number;
  skipped?: boolean;
  message?: string;
}

/**
 * Copy a destination's attractions into the location tree.
 *
 * Called after the Destinations screen saves them, so an admin types
 * "Shangrila Lake" once rather than there and again under Skardu — two lists
 * maintained by hand disagree, and they disagree quietly.
 *
 * Attractions removed from the destination are deactivated, never deleted: a
 * provider may already have said they run tours there, and dropping that
 * because someone edited a blurb is not a trade anyone agreed to.
 */
export function syncAttractions(destinationId: string): Promise<SyncAttractionsResult> {
  return post({ action: "sync_attractions", destinationId }) as Promise<SyncAttractionsResult>;
}

/** Set or clear one flag on one location. `null` resets it to inherited. */
export function setLocationFlag(
  locationId: string,
  flag: AreaFlag,
  value: boolean | null
) {
  return post({ action: "set_location_flag", locationId, flag, value });
}

/** Set or clear one flag for one service within one area. */
export function setServiceFlag(
  locationId: string,
  serviceSlug: string,
  flag: ServiceFlag,
  value: boolean | null
) {
  return post({ action: "set_service_flag", locationId, serviceSlug, flag, value });
}

/** Apply one flag to a location and everything beneath it. */
export function applyToChildren(
  locationId: string,
  flag: AreaFlag,
  value: boolean | null
) {
  return post({ action: "apply_to_children", locationId, flag, value });
}

/** Set the same flag across several selected areas. */
export function bulkSetFlag(
  locationIds: string[],
  flag: AreaFlag,
  value: boolean | null
) {
  return post({ action: "bulk_set_flag", locationIds, flag, value });
}

/* ------------------------------------------------------------------ */
/* Creating locations                                                  */
/* ------------------------------------------------------------------ */

export const LOCATION_TYPES = [
  "country",
  "region",
  "division",
  "district",
  "city",
  "area",
  /* Attractions and landmarks are locations, not a separate table.
     location_type is free text in the database precisely so a level can be
     added without a migration, and an attraction genuinely behaves like one:
     it has a parent, coordinates, a slug, SEO, and the same visibility flags.
     Giving it its own table would mean duplicating all of that, and the brief
     is explicit about not creating parallel systems.

     They are last in the list because suggestChildType never proposes them —
     an admin adds an attraction on purpose, and a district full of accidental
     landmarks is worse than one with none. */
  "attraction",
  "landmark",
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  country: "Country",
  region: "Region / Province",
  division: "Division",
  district: "District",
  city: "City / Town",
  area: "Area / Destination",
  attraction: "Attraction",
  landmark: "Landmark",
};

/**
 * The level a child of this parent would normally be.
 *
 * A suggestion, not a rule — administrative structures differ and the admin
 * can override it. But defaulting correctly is what stops a tree slowly
 * filling with districts nested inside districts.
 */
export function suggestChildType(parentType: string | null): LocationType {
  switch (parentType) {
    case null:
    case undefined:
      return "country";
    case "country":
      return "region";
    case "region":
      return "division";
    case "division":
      return "district";
    case "district":
      return "area";
    case "city":
      return "area";
    default:
      return "area";
  }
}

/** "Basho Valley" → "basho-valley". Matches the database CHECK constraint. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ------------------------------------------------------------------ */
/* GeoNames lookup                                                     */
/* ------------------------------------------------------------------ */

export interface GeoSuggestion {
  geonameid: number;
  name: string;
  suggested_type: LocationType;
  admin_path: string | null;
  latitude: number | null;
  longitude: number | null;
  feature_code: string | null;
  population: number | null;
}

/**
 * Search the GeoNames reference table.
 *
 * Returns [] when the table does not exist or the import has not been run —
 * the Add Location form then simply behaves as a plain manual form, which is
 * how it worked before this existed.
 */
export async function searchGeo(
  query: string,
  country = "PK"
): Promise<GeoSuggestion[]> {
  if (!isSupabaseConfigured || query.trim().length < 2) return [];
  try {
    const { data, error } = await supabase.rpc("search_geo_reference", {
      p_query: query.trim(),
      p_country: country,
      p_limit: 12,
    });

    if (error) {
      /* An empty dropdown with no explanation is unfindable — the first
         version of this swallowed a PostgREST signature mismatch and the
         form silently showed nothing for no visible reason.
         "Not found" is expected before the migration runs; anything else
         is worth seeing. */
      if (!/schema cache|does not exist|not find the function/i.test(error.message)) {
        console.warn("[searchGeo] lookup failed:", error.message);
      }
      return [];
    }
    return Array.isArray(data) ? (data as GeoSuggestion[]) : [];
  } catch (e) {
    console.warn("[searchGeo] request failed:", (e as Error)?.message);
    return [];
  }
}

export function createLocation(input: {
  marketId: string;
  parentId: string | null;
  name: string;
  slug: string;
  locationType: LocationType;
  latitude?: string | number | null;
  longitude?: string | number | null;
  displayOrder?: number;
}) {
  return post({ action: "create_location", ...input });
}

export interface SeoDraft {
  seo_title: string;
  meta_description: string;
  h1: string;
  intro: string;
  body: string;
  focus_keyword: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  og_image: string;
  hero_image: string;
  hero_image_alt: string;
  faq: { q: string; a: string }[];
  robots_index: boolean;
  robots_follow: boolean;
}

export const EMPTY_SEO: SeoDraft = {
  seo_title: "",
  meta_description: "",
  h1: "",
  intro: "",
  body: "",
  focus_keyword: "",
  canonical_url: "",
  og_title: "",
  og_description: "",
  og_image: "",
  hero_image: "",
  hero_image_alt: "",
  faq: [],
  // Opt-in, never opt-out. A new page must be earned into the index.
  robots_index: false,
  robots_follow: true,
};

/** Existing SEO row for a location (or a location+service page). */
export async function getSeo(
  locationId: string,
  serviceSlug: string | null
): Promise<SeoDraft | null> {
  if (!isSupabaseConfigured || !locationId) return null;

  let q = supabase
    .from("location_seo")
    .select("*")
    .eq("location_id", locationId)
    .eq("language_code", "en");
  q = serviceSlug ? q.eq("service_slug", serviceSlug) : q.is("service_slug", null);

  const { data } = await q.maybeSingle();
  if (!data) return null;

  const r = data as Record<string, unknown>;
  const str = (k: string) => String(r[k] ?? "");
  return {
    seo_title: str("seo_title"),
    meta_description: str("meta_description"),
    h1: str("h1"),
    intro: str("intro"),
    body: str("body"),
    focus_keyword: str("focus_keyword"),
    canonical_url: str("canonical_url"),
    og_title: str("og_title"),
    og_description: str("og_description"),
    og_image: str("og_image"),
    hero_image: str("hero_image"),
    hero_image_alt: str("hero_image_alt"),
    faq: Array.isArray(r.faq) ? (r.faq as { q: string; a: string }[]) : [],
    robots_index: Boolean(r.robots_index),
    robots_follow: r.robots_follow !== false,
  };
}

export function saveSeo(
  locationId: string,
  serviceSlug: string | null,
  patch: Partial<SeoDraft>
) {
  return post({ action: "save_seo", locationId, serviceSlug, patch });
}

/** Approved listings in an area and everything under it. */
export async function getListingCount(locationId: string): Promise<number> {
  if (!isSupabaseConfigured || !locationId) return 0;
  const { data } = await supabase.rpc("listing_count_at", {
    p_location_id: locationId,
  });
  return typeof data === "number" ? data : 0;
}

export function updateLocation(
  locationId: string,
  patch: Partial<Pick<LocationRow, "name" | "display_order" | "latitude" | "longitude" | "coming_soon_message">>
) {
  return post({ action: "update_location", locationId, patch });
}
