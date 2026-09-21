import { supabase } from "@/lib/supabase";
import { getAllHotels } from "@/lib/hotels";
import { getAllHomestays } from "@/lib/homestays";
import { getAllHostels } from "@/lib/hostels";
import {
  getAllCompanies as getAllTourCompanies,
  getAllPackages,
  getAllGuides,
  getAllTransports,
} from "@/lib/tour-companies";
import {
  getAllProviders as getAllTransportProviders,
  getAllTransportServices,
  getAllRentalVehicles,
} from "@/lib/transport";
import { getAllCompanies as getAllExpeditionCompanies } from "@/lib/expeditions";
import { getAllRentalItems } from "@/lib/rentals";
import { getAllMediaProviders } from "@/lib/media";
import { getAllRestaurants } from "@/lib/restaurants";
import { getAllActivities } from "@/lib/activities";
import { getAllCoworking } from "@/lib/coworking";
import { getAllRoadsideProviders } from "@/lib/roadside";

/**
 * Admin moderation actions that operate directly on the real Supabase listing
 * tables (unlike the legacy localStorage partner-store). Every managed listing
 * table shares the same `status` + `owner_email` columns, so hide / unhide /
 * delete can be done generically by table name.
 */

export interface ManagedListing {
  type: string; // human label
  table: string; // supabase table name
  id: string;
  title: string;
  ownerEmail: string;
  status: string; // pending | approved | rejected
  /** Location and price, when the row carries them — see `detailOf`. */
  detail: string;
}

/* ------------------------------------------------------------------
   A line that tells two same-named listings apart.

   Titles are not unique and often not descriptive: a transport fleet
   can hold three vehicles all called "Car". Deleting is permanent, so
   the screen has to show enough to be sure which row is which BEFORE
   the button is pressed — the location and the price are what the
   admin recognises from the Listings tab.

   Every listing table names these columns differently, so rather than
   a map per table this reads whichever of the known aliases is
   present. A row with none of them gets an empty string and simply
   shows nothing extra, which is what it did before.
   ------------------------------------------------------------------ */
const PLACE_KEYS = ["location", "city", "district", "route", "address", "area"] as const;
const PRICE_KEYS = [
  "price",
  "price_per_day",
  "price_per_trip",
  "starting_price",
  "price_per_night",
  "daily_rate",
] as const;

function detailOf(r: Record<string, unknown>): string {
  const bits: string[] = [];

  for (const k of PLACE_KEYS) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) {
      bits.push(v.trim());
      break;
    }
  }

  for (const k of PRICE_KEYS) {
    const v = r[k];
    // 0 is a real price ("free"), so test the type rather than truthiness.
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n)) {
      bits.push(`PKR ${n.toLocaleString("en-PK")}`);
      break;
    }
  }

  return bits.join(" · ");
}

interface TypeDef {
  label: string;
  table: string;
  getAll: () => Promise<unknown[]>;
}

/** Every public-facing listing table an owner can create. */
const TYPES: TypeDef[] = [
  { label: "Hotel", table: "hotels", getAll: getAllHotels },
  { label: "Homestay", table: "homestays", getAll: getAllHomestays },
  { label: "Hostel", table: "hostels", getAll: getAllHostels },
  { label: "Tour Company", table: "tour_companies", getAll: getAllTourCompanies },
  { label: "Tour Package", table: "tour_packages", getAll: getAllPackages },
  { label: "Transport Provider", table: "transport_providers", getAll: getAllTransportProviders },
  /* ------------------------------------------------------------------
     The four below were missing, and the gap was not cosmetic.

     `transport_providers` is the COMPANY. The rows a traveller actually
     books — the individual vehicle, route service or rental — live in
     `transports`, `transport_services` and `rental_vehicles`, and none
     of them appeared here. So a vehicle listed on the site could be seen
     in the admin Listings tab and removed from nowhere: the only screen
     with hide and delete buttons never loaded its table.

     All four carry the same `status` + `owner_email` columns as the rest
     and are covered by the phase30b RLS policies (`owner_email =
     auth.email() or public.is_admin()`), so the generic hide / unhide /
     delete below work on them unchanged — and the database, not the UI,
     is what refuses a non-admin.
     ------------------------------------------------------------------ */
  { label: "Transport Vehicle", table: "transports", getAll: getAllTransports },
  { label: "Transport Service", table: "transport_services", getAll: getAllTransportServices },
  { label: "Rental Vehicle", table: "rental_vehicles", getAll: getAllRentalVehicles },
  { label: "Rental Item", table: "rental_items", getAll: getAllRentalItems },
  { label: "Expedition Company", table: "expedition_companies", getAll: getAllExpeditionCompanies },
  { label: "Tour Guide", table: "tour_guides", getAll: getAllGuides },
  { label: "Media / Photographer", table: "media_providers", getAll: getAllMediaProviders },
  { label: "Restaurant", table: "restaurants", getAll: getAllRestaurants },
  { label: "Activity", table: "activities", getAll: getAllActivities },
  { label: "Co-working Space", table: "coworking_spaces", getAll: getAllCoworking },
  { label: "Roadside Provider", table: "roadside_providers", getAll: getAllRoadsideProviders },
];

/** Tables that carry an `owner_email` column (used for owner-wide deletes). */
export const OWNER_TABLES = TYPES.map((t) => t.table);

/** Aggregate every listing across all types into one uniform, searchable list. */
export async function getAllManagedListings(): Promise<ManagedListing[]> {
  const groups = await Promise.all(
    TYPES.map(async (t) => {
      try {
        const rows = await t.getAll();
        return rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            type: t.label,
            table: t.table,
            id: String(r.id ?? ""),
            title: String(r.title ?? r.name ?? "Untitled"),
            ownerEmail: String(r.owner_email ?? ""),
            status: String(r.status ?? "pending"),
            detail: detailOf(r),
          } as ManagedListing;
        });
      } catch {
        return [] as ManagedListing[];
      }
    })
  );
  return groups.flat().filter((l) => l.id);
}

/** Hide a listing from the public site (reversible). */
export async function adminHideListing(table: string, id: string) {
  return supabase.from(table).update({ status: "rejected" }).eq("id", id);
}

/** Restore a hidden listing to the public site. */
export async function adminUnhideListing(table: string, id: string) {
  return supabase.from(table).update({ status: "approved" }).eq("id", id);
}

/** Permanently delete a single listing row. Cannot be undone. */
export async function adminDeleteListing(table: string, id: string) {
  return supabase.from(table).delete().eq("id", id);
}

/**
 * Permanently delete every listing owned by an email across all listing tables.
 * This removes the owner's presence from the public site. It does NOT delete the
 * owner's login (Supabase Auth) account — that must be done from the Supabase
 * dashboard (Authentication → Users) or a future secure admin endpoint.
 */
export async function adminDeleteOwnerListings(email: string) {
  // Exact match on the stored value (avoid ilike so `_` in an address is not
  // treated as a wildcard).
  await Promise.all(
    OWNER_TABLES.map((t) => supabase.from(t).delete().eq("owner_email", email))
  );
}
