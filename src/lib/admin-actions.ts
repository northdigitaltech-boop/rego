import { supabase } from "@/lib/supabase";
import { getAllHotels } from "@/lib/hotels";
import { getAllHomestays } from "@/lib/homestays";
import { getAllHostels } from "@/lib/hostels";
import {
  getAllCompanies as getAllTourCompanies,
  getAllPackages,
  getAllGuides,
} from "@/lib/tour-companies";
import { getAllProviders as getAllTransportProviders } from "@/lib/transport";
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
