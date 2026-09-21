import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getApprovedRentals } from "@/lib/transport";
import { getAllCoworking } from "@/lib/coworking";
import type { CategorySlug, Listing } from "@/lib/data";

/* ============================================================
 * Rentals — a discovery layer, not a second marketplace.
 *
 * Every rental on Rego already lives in a table of its own:
 * vehicles in rental_vehicles, workspaces in coworking_spaces,
 * whole properties in homestays, equipment in rental_items. This
 * module reads them through one view and never writes a copy, so
 * a Land Cruiser found under Rentals and the same Land Cruiser
 * found under Transport are one row with one id and one URL.
 *
 * See supabase/phase136-rentals.sql for why the view exists
 * rather than an is_rental column on sixteen tables.
 * ============================================================ */

/** The eight types, in the order they are shown. */
export const RENTAL_TYPES = [
  "car",
  "bike",
  "jeep_4x4",
  "camera",
  "photography_equipment",
  "camping_equipment",
  "house",
  "coworking_space",
  "other",
] as const;

export type RentalType = (typeof RENTAL_TYPES)[number];

export interface RentalTypeDef {
  type: RentalType;
  /** URL value — short and readable: /rentals?type=jeep */
  slug: string;
  label: string;
  /** One line under the card. Describes what it is, claims nothing. */
  blurb: string;
  /** lucide-react icon name, resolved by the card component. */
  icon: string;
}

/* Slugs are shorter than the stored type on purpose: `jeep` reads
   better in a URL than `jeep_4x4`, and the stored value stays the
   thing the database checks. One map, both directions, so a rename
   cannot leave a link pointing at nothing. */
export const RENTAL_TYPE_DEFS: RentalTypeDef[] = [
  { type: "car", slug: "car", label: "Car Rental", blurb: "Self-drive and chauffeured cars", icon: "Car" },
  { type: "bike", slug: "bike", label: "Bike Rental", blurb: "Motorbikes for the valleys", icon: "Bike" },
  { type: "jeep_4x4", slug: "jeep", label: "Jeep & 4x4", blurb: "High-clearance vehicles for rough roads", icon: "Truck" },
  { type: "camera", slug: "camera", label: "Camera Rental", blurb: "Bodies, lenses and drones by the day", icon: "Camera" },
  { type: "photography_equipment", slug: "photo-gear", label: "Photography Equipment", blurb: "Lighting, gimbals and rigs", icon: "Aperture" },
  { type: "camping_equipment", slug: "camping", label: "Camping Equipment", blurb: "Tents, bags and trekking kit", icon: "Tent" },
  { type: "house", slug: "house", label: "House Rental", blurb: "Whole homes and holiday properties", icon: "Home" },
  { type: "coworking_space", slug: "coworking", label: "Co-working Space", blurb: "Desks, offices and meeting rooms", icon: "Building2" },
  { type: "other", slug: "other", label: "Other Rentals", blurb: "Everything else available to hire", icon: "Package" },
];

const BY_SLUG = new Map(RENTAL_TYPE_DEFS.map((d) => [d.slug, d]));
const BY_TYPE = new Map(RENTAL_TYPE_DEFS.map((d) => [d.type, d]));

export function rentalTypeBySlug(slug: string | null | undefined): RentalTypeDef | null {
  return (slug && BY_SLUG.get(slug)) || null;
}
export function rentalTypeLabel(type: string): string {
  return BY_TYPE.get(type as RentalType)?.label ?? "Rental";
}
export function rentalTypeSlug(type: string): string {
  return BY_TYPE.get(type as RentalType)?.slug ?? "other";
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

/** One row of public.rentals. Shape mirrors the view exactly. */
export interface RentalRow {
  source_table: string;
  source_id: string;
  rental_type: string;
  title: string;
  provider_name: string | null;
  owner_email: string | null;
  price: number | null;
  price_unit: string | null;
  location: string | null;
  image: string | null;
  rating: number;
  reviews: number;
  verified: boolean;
  featured: boolean;
  /** Vehicles only: Self Drive | With Driver Optional | Private Rental. */
  rental_option: string | null;
  security_deposit: number | null;
  created_at: string;
}

export type RentalSort =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "newest";

export interface RentalQuery {
  type?: string | null;
  /** Matches title, provider and location. */
  search?: string | null;
  location?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  /** Vehicles only; ignored for every other type. */
  driver?: "with" | "without" | null;
  verifiedOnly?: boolean;
  minRating?: number | null;
  sort?: RentalSort;
  limit?: number;
  offset?: number;
}

export interface RentalPage {
  rentals: RentalRow[];
  total: number;
  /** True when the view is missing and this came from the fallback. */
  degraded: boolean;
}

/* Postgres: relation does not exist. phase136 has not been run yet. */
const UNDEFINED_TABLE = "42P01";

/**
 * The detail URL. Deliberately the SAME url the listing has in its own
 * category — a rental discovered under Rentals and the same rental
 * discovered under Transport open one page, so nothing competes with
 * itself in search results.
 */
export function rentalHref(r: Pick<RentalRow, "source_id">): string {
  return `/listings/${r.source_id}`;
}

/* ------------------------------------------------------------------
   MAIN CATEGORY vs RENTAL TYPE.

   Rentals is a discovery classification laid over the categories a
   listing already belongs to — a Land Cruiser is a Transport listing
   that happens to be for hire. This map says where each rental type
   fundamentally lives, so a card carries its real home rather than
   pretending "rental" is its category.
   ------------------------------------------------------------------ */
const HOME_CATEGORY: Record<RentalType, CategorySlug> = {
  car: "vehicle-rental",
  bike: "vehicle-rental",
  jeep_4x4: "vehicle-rental",
  camera: "photographers",
  photography_equipment: "photographers",
  camping_equipment: "activities",
  house: "homestays",
  coworking_space: "coworking",
  other: "more",
};

/**
 * Shape a rental row as a Listing so the existing ServiceCard renders it.
 * Nothing is invented: a missing image or provider stays missing, and the
 * card already degrades for both.
 */
export function rentalToListing(r: RentalRow): Listing {
  return {
    id: r.source_id,
    title: r.title,
    category: HOME_CATEGORY[r.rental_type as RentalType] ?? "more",
    categoryLabel: rentalTypeLabel(r.rental_type),
    location: r.location ?? "Gilgit Baltistan",
    price: r.price ?? 0,
    unit: r.price_unit ?? "day",
    rating: Number(r.rating),
    reviews: r.reviews,
    image: r.image ?? "",
    provider: r.provider_name ?? undefined,
    featured: r.featured,
    createdAt: r.created_at,
  };
}

function applySort<T extends { price: number | null; rating: number; reviews: number; featured: boolean; created_at: string }>(
  rows: T[],
  sort: RentalSort
): T[] {
  const copy = [...rows];
  const price = (r: T) => (typeof r.price === "number" ? r.price : Number.POSITIVE_INFINITY);
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => price(a) - price(b));
    case "price_desc":
      return copy.sort((a, b) => price(b) - price(a));
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    case "newest":
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
    default:
      // Recommended: featured first, then better-reviewed.
      return copy.sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          b.rating - a.rating ||
          b.reviews - a.reviews
      );
  }
}

/**
 * Read the rentals.
 *
 * Filtering and sorting happen in Postgres wherever the view allows it,
 * so a page of twelve does not download the catalogue. `degraded` says
 * whether phase136 is applied — see fallbackRentals below.
 */
export async function getRentals(q: RentalQuery = {}): Promise<RentalPage> {
  if (!isSupabaseConfigured) return { rentals: [], total: 0, degraded: false };

  const limit = Math.min(Math.max(q.limit ?? 24, 1), 60);
  const offset = Math.max(q.offset ?? 0, 0);
  const sort = q.sort ?? "recommended";

  try {
    let query = supabase.from("rentals").select("*", { count: "exact" });

    if (q.type) query = query.eq("rental_type", q.type);
    if (q.location?.trim()) query = query.ilike("location", `%${q.location.trim()}%`);
    if (typeof q.minPrice === "number") query = query.gte("price", q.minPrice);
    if (typeof q.maxPrice === "number") query = query.lte("price", q.maxPrice);
    if (q.verifiedOnly) query = query.eq("verified", true);
    if (typeof q.minRating === "number") query = query.gte("rating", q.minRating);

    /* Vehicles only. "Without driver" is Self Drive; "with driver" covers
       both the driver-optional and private-hire wordings the transport
       dashboard offers, because either can be supplied with one. */
    if (q.driver === "without") query = query.eq("rental_option", "Self Drive");
    if (q.driver === "with") query = query.neq("rental_option", "Self Drive");

    if (q.search?.trim()) {
      // Strip PostgREST's own separators so a stray comma cannot break the or().
      const t = q.search.trim().replace(/[%,()]/g, "");
      if (t) {
        query = query.or(
          `title.ilike.%${t}%,provider_name.ilike.%${t}%,location.ilike.%${t}%`
        );
      }
    }

    switch (sort) {
      case "price_asc":
        query = query.order("price", { ascending: true, nullsFirst: false });
        break;
      case "price_desc":
        query = query.order("price", { ascending: false, nullsFirst: false });
        break;
      case "rating":
        query = query.order("rating", { ascending: false }).order("reviews", { ascending: false });
        break;
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      default:
        query = query
          .order("featured", { ascending: false })
          .order("rating", { ascending: false });
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      if (error.code === UNDEFINED_TABLE) return fallbackRentals(q, limit, offset, sort);
      return { rentals: [], total: 0, degraded: false };
    }

    return {
      rentals: (data as unknown as RentalRow[]) ?? [],
      total: count ?? 0,
      degraded: false,
    };
  } catch {
    return { rentals: [], total: 0, degraded: false };
  }
}

/**
 * Counts per type, for the category cards.
 *
 * One grouped read rather than nine queries. The cards show real
 * numbers or none at all — never an invented figure.
 */
export async function getRentalCounts(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured) return {};
  try {
    const { data, error } = await supabase.from("rentals").select("rental_type");
    if (error) {
      if (error.code !== UNDEFINED_TABLE) return {};
      const { rentals } = await fallbackRentals({}, 1000, 0, "recommended");
      return tally(rentals);
    }
    return tally((data as { rental_type: string }[]) ?? []);
  } catch {
    return {};
  }
}

function tally(rows: { rental_type: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.rental_type] = (out[r.rental_type] ?? 0) + 1;
  return out;
}

/* ------------------------------------------------------------------ */
/* rental_items — the provider-facing table                            */
/* ------------------------------------------------------------------ */

/** One row of public.rental_items. */
export interface RentalItemRow {
  id: string;
  owner_email: string | null;
  provider_name: string | null;
  title: string;
  rental_type: RentalType;
  brand: string | null;
  model: string | null;
  description: string | null;
  includes: string[] | null;
  capacity: number | null;
  quantity: number | null;
  price_per_hour: number | null;
  price_per_day: number;
  weekly_price: number | null;
  monthly_price: number | null;
  security_deposit: number | null;
  pricing_unit: string;
  min_days: number | null;
  max_days: number | null;
  required_documents: string[] | null;
  damage_policy: string | null;
  terms: string | null;
  delivery_available: boolean;
  pickup_location: string | null;
  return_location: string | null;
  location: string | null;
  city: string | null;
  image: string | null;
  images: string[] | null;
  rating: number;
  reviews: number;
  verified: boolean;
  featured: boolean;
  status: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type RentalItemInput = Partial<
  Omit<RentalItemRow, "id" | "created_at" | "updated_at">
> & { title: string; price_per_day: number };

/** Every item, whatever its status — admin moderation only. */
export async function getAllRentalItems(): Promise<RentalItemRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("rental_items")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as RentalItemRow[]) ?? [];
}

/** A provider's own items, at any status, so they can see what is pending. */
export async function getRentalItemsByOwner(email: string): Promise<RentalItemRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("rental_items")
    .select("*")
    .eq("owner_email", email.trim().toLowerCase())
    .order("created_at", { ascending: false });
  return (data as RentalItemRow[]) ?? [];
}

export async function getRentalItemById(id: string): Promise<RentalItemRow | null> {
  if (!isSupabaseConfigured || !id) return null;
  const { data } = await supabase.from("rental_items").select("*").eq("id", id).maybeSingle();
  return (data as RentalItemRow) ?? null;
}

/* ------------------------------------------------------------------
   Writes.

   status is deliberately NOT accepted from the caller. A provider
   creating an item cannot hand it status: 'approved' and skip the
   queue — the column keeps its 'pending' default, and RLS plus
   phase111's status guard enforce the same thing at the database.
   Stripping it here as well means the client never even asks.
   ------------------------------------------------------------------ */
function withoutPrivileged(input: Partial<RentalItemRow>) {
  const {
    status: _status,
    verified: _verified,
    featured: _featured,
    rating: _rating,
    reviews: _reviews,
    ...safe
  } = input;
  return safe;
}

export async function createRentalItem(input: RentalItemInput) {
  return supabase.from("rental_items").insert(withoutPrivileged(input)).select().single();
}

export async function updateRentalItem(id: string, input: Partial<RentalItemInput>) {
  return supabase
    .from("rental_items")
    .update({ ...withoutPrivileged(input), updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deleteRentalItem(id: string) {
  return supabase.from("rental_items").delete().eq("id", id);
}

/* ------------------------------------------------------------------ */
/* Fallback                                                            */
/* ------------------------------------------------------------------ */

/**
 * What /rentals shows before phase136 is applied.
 *
 * Migration files in this project have drifted from the live schema
 * more than once, and a Rentals page that renders an empty state on a
 * database full of rental vehicles would look like the feature is
 * broken rather than like a migration is pending. So the two sources
 * that need no new schema — vehicles and co-working — are read
 * directly and shaped into the same rows.
 *
 * Equipment and houses cannot appear here: one needs a table that does
 * not exist yet, the other a column that does not. `degraded` is true
 * so the page can say so plainly instead of implying the catalogue is
 * complete.
 */
async function fallbackRentals(
  q: RentalQuery,
  limit: number,
  offset: number,
  sort: RentalSort
): Promise<RentalPage> {
  const [vehicles, spaces] = await Promise.all([
    getApprovedRentals().catch(() => []),
    getAllCoworking().catch(() => []),
  ]);

  const vehicleType = (t: string | null): RentalType => {
    switch ((t ?? "").toLowerCase()) {
      case "car":
      case "van":
        return "car";
      case "bike":
        return "bike";
      case "jeep":
        return "jeep_4x4";
      default:
        return "other";
    }
  };

  const rows: RentalRow[] = [
    ...vehicles.map((v) => ({
      source_table: "rental_vehicles",
      source_id: v.id,
      rental_type: vehicleType(v.vehicle_type),
      title: v.title,
      provider_name: v.provider_name,
      owner_email: v.owner_email,
      price: v.price_per_day,
      price_unit: "day",
      location: v.location || v.pickup_location,
      image: v.image,
      rating: Number(v.rating),
      reviews: v.reviews,
      verified: false,
      featured: v.featured,
      rental_option: v.rental_type,
      security_deposit: v.security_deposit,
      created_at: v.created_at,
    })),
    ...spaces
      .filter((s) => s.status === "approved")
      .map((s) => {
        /* Same rule as the view: a zero price is "not offered", not free. */
        const prices = [
          s.hot_desk_price,
          s.dedicated_desk_price,
          s.private_office_price,
          s.meeting_room_price,
        ].filter((p): p is number => typeof p === "number" && p > 0);
        return {
          source_table: "coworking_spaces",
          source_id: s.id,
          rental_type: "coworking_space",
          title: s.name,
          provider_name: s.owner_name ?? null,
          owner_email: s.owner_email ?? null,
          price: prices.length ? Math.min(...prices) : null,
          price_unit: "day",
          location: s.location || s.city,
          image: s.cover_image,
          rating: Number(s.rating),
          reviews: s.reviews,
          verified: s.verified,
          featured: s.featured,
          rental_option: null,
          security_deposit: null,
          created_at: s.created_at,
        };
      }),
  ];

  const needle = q.search?.trim().toLowerCase() ?? "";
  const filtered = rows.filter((r) => {
    if (q.type && r.rental_type !== q.type) return false;
    if (q.verifiedOnly && !r.verified) return false;
    if (typeof q.minRating === "number" && r.rating < q.minRating) return false;
    if (typeof q.minPrice === "number" && (r.price ?? 0) < q.minPrice) return false;
    if (typeof q.maxPrice === "number" && (r.price ?? Infinity) > q.maxPrice) return false;
    if (q.driver === "without" && r.rental_option !== "Self Drive") return false;
    if (q.driver === "with" && r.rental_option === "Self Drive") return false;
    if (q.location?.trim() && !(r.location ?? "").toLowerCase().includes(q.location.trim().toLowerCase()))
      return false;
    if (needle) {
      const hay = `${r.title} ${r.provider_name ?? ""} ${r.location ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const sorted = applySort(filtered, sort);
  return {
    rentals: sorted.slice(offset, offset + limit),
    total: sorted.length,
    degraded: true,
  };
}
