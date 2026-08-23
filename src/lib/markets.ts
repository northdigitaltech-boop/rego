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

export function updateLocation(
  locationId: string,
  patch: Partial<Pick<LocationRow, "name" | "display_order" | "latitude" | "longitude" | "coming_soon_message">>
) {
  return post({ action: "update_location", locationId, patch });
}
