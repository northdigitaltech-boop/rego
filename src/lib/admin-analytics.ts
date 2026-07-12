import { supabase, isSupabaseConfigured } from "@/lib/supabase";

import { getAllHotels, setHotelStatus, setHotelVerified, deleteHotel } from "@/lib/hotels";
import {
  getAllHomestays,
  setHomestayStatus,
  setHomestayVerified,
  deleteHomestay,
} from "@/lib/homestays";
import {
  getAllCompanies,
  setCompanyStatus,
  setCompanyVerified,
  getAllPackages,
  setPackageStatus,
  deletePackage,
  getAllGuides,
  setGuideStatus,
  setGuideVerified,
  deleteGuide,
} from "@/lib/tour-companies";
import {
  getAllMediaProviders,
  setMediaProviderStatus,
  setMediaProviderVerified,
  deleteMediaProvider,
} from "@/lib/media";
import {
  getAllRestaurants,
  setRestaurantStatus,
  setRestaurantVerified,
  deleteRestaurant,
} from "@/lib/restaurants";
import { getAllProviders, setProviderStatus, setProviderVerified } from "@/lib/transport";
import {
  getAllRoadsideProviders,
  setRoadsideProviderStatus,
  setRoadsideProviderVerified,
  deleteRoadsideProvider,
} from "@/lib/roadside";
import {
  getAllCoworking,
  setCoworkingStatus,
  setCoworkingVerified,
  deleteCoworking,
} from "@/lib/coworking";
import {
  getAllActivities,
  setActivityStatus,
  setActivityVerified,
  deleteActivity,
} from "@/lib/activities";
import { getAllEvents, setEventStatus, deleteEvent } from "@/lib/events";

/** Normalised row for the consistent admin table across every module. */
export interface AdminRow {
  id: string;
  business: string;
  ownerEmail: string;
  city: string;
  category: string;
  metric: number; // module-specific numeric (rooms / years / price …), 0 if n/a
  status: string; // pending | approved | rejected | suspended
  verified: boolean;
  created_at: string;
}

export interface ModuleConfig {
  id: string;
  name: string;
  icon: string; // lucide icon name, mapped in the component
  live: boolean;
  table: string;
  bookingTable?: string;
  metricLabel: string;
  addHref: string;
  load?: () => Promise<AdminRow[]>;
  setStatus?: (id: string, status: string) => unknown;
  setVerified?: (id: string, verified: boolean) => unknown;
  remove?: (id: string) => unknown;
}

const s = (v: unknown) => (v == null ? "" : String(v));

export const MODULES: ModuleConfig[] = [
  {
    id: "hotels",
    name: "Hotels & Resorts",
    icon: "Building2",
    live: true,
    table: "hotels",
    bookingTable: "bookings",
    metricLabel: "Rooms",
    addHref: "/categories/hotels",
    load: async () =>
      (await getAllHotels()).map((h) => ({
        id: h.id,
        business: h.title,
        ownerEmail: s(h.owner_email),
        city: s(h.location),
        category: s(h.category_label) || "Hotel",
        metric: h.total_rooms ?? 0,
        status: h.status,
        verified: h.verified,
        created_at: h.created_at,
      })),
    setStatus: setHotelStatus,
    setVerified: setHotelVerified,
    remove: deleteHotel,
  },
  {
    id: "homestays",
    name: "Homestays",
    icon: "Home",
    live: true,
    table: "homestays",
    bookingTable: "homestay_bookings",
    metricLabel: "Rooms",
    addHref: "/categories/homestays",
    load: async () =>
      (await getAllHomestays()).map((h) => ({
        id: h.id,
        business: h.title,
        ownerEmail: s(h.owner_email),
        city: s(h.location),
        category: s(h.category_label) || "Homestay",
        metric: h.total_rooms ?? 0,
        status: h.status,
        verified: h.verified,
        created_at: h.created_at,
      })),
    setStatus: setHomestayStatus,
    setVerified: setHomestayVerified,
    remove: deleteHomestay,
  },
  {
    id: "companies",
    name: "Tour Companies",
    icon: "Briefcase",
    live: true,
    table: "tour_companies",
    bookingTable: "tour_bookings",
    metricLabel: "Experience (yrs)",
    addHref: "/categories/travel-companies",
    load: async () =>
      (await getAllCompanies()).map((c) => ({
        id: c.id,
        business: c.name,
        ownerEmail: s(c.owner_email),
        city: s(c.location),
        category: "Tour Company",
        metric: Number(c.experience_years ?? 0),
        status: c.status,
        verified: c.verified,
        created_at: c.created_at,
      })),
    setStatus: setCompanyStatus,
    setVerified: setCompanyVerified,
  },
  {
    id: "packages",
    name: "Tour Packages",
    icon: "Map",
    live: true,
    table: "tour_packages",
    bookingTable: "tour_bookings",
    metricLabel: "Price",
    addHref: "/categories/tours",
    load: async () =>
      (await getAllPackages()).map((p) => ({
        id: p.id,
        business: s(p.title),
        ownerEmail: s((p as { company_name?: string }).company_name),
        city: s((p as { destination?: string }).destination),
        category: "Tour Package",
        metric: Number((p as { price_per_person?: number }).price_per_person ?? 0),
        status: p.status,
        verified: true,
        created_at: p.created_at,
      })),
    setStatus: setPackageStatus,
    remove: deletePackage,
  },
  {
    id: "guides",
    name: "Tour Guides",
    icon: "UserRound",
    live: true,
    table: "tour_guides",
    bookingTable: "guide_bookings",
    metricLabel: "Experience (yrs)",
    addHref: "/categories/guides",
    load: async () =>
      (await getAllGuides()).map((g) => ({
        id: g.id,
        business: g.name,
        ownerEmail: s(g.owner_email),
        city: s((g as { city?: string; location?: string }).city || (g as { location?: string }).location),
        category: "Guide",
        metric: Number((g as { experience_years?: number }).experience_years ?? 0),
        status: g.status,
        verified: !!g.verified,
        created_at: g.created_at,
      })),
    setStatus: setGuideStatus,
    setVerified: setGuideVerified,
    remove: deleteGuide,
  },
  {
    id: "media",
    name: "Photographer & Videographer",
    icon: "Camera",
    live: true,
    table: "media_providers",
    bookingTable: "media_bookings",
    metricLabel: "Experience (yrs)",
    addHref: "/categories/photographers",
    load: async () =>
      (await getAllMediaProviders()).map((m) => ({
        id: m.id,
        business: m.name,
        ownerEmail: s(m.owner_email),
        city: s(m.city || m.location),
        category: s(m.service_type) || "Media",
        metric: Number(m.experience_years ?? 0),
        status: m.status,
        verified: !!m.verified,
        created_at: m.created_at,
      })),
    setStatus: setMediaProviderStatus,
    setVerified: setMediaProviderVerified,
    remove: deleteMediaProvider,
  },
  {
    id: "restaurants",
    name: "Restaurants",
    icon: "UtensilsCrossed",
    live: true,
    table: "restaurants",
    bookingTable: "restaurant_bookings",
    metricLabel: "—",
    addHref: "/categories/restaurants",
    load: async () =>
      (await getAllRestaurants()).map((r) => ({
        id: r.id,
        business: r.name,
        ownerEmail: s(r.owner_email),
        city: s(r.city || r.location),
        category: (r.cuisine_types ?? []).slice(0, 2).join(", ") || "Restaurant",
        metric: 0,
        status: r.status,
        verified: !!r.verified,
        created_at: r.created_at,
      })),
    setStatus: setRestaurantStatus,
    setVerified: setRestaurantVerified,
    remove: deleteRestaurant,
  },
  {
    id: "transport",
    name: "Transport / Rentals",
    icon: "Bus",
    live: true,
    table: "transport_providers",
    bookingTable: "transport_bookings",
    metricLabel: "—",
    addHref: "/categories/transport",
    load: async () =>
      (await getAllProviders()).map((p) => ({
        id: p.id,
        business: p.name,
        ownerEmail: s(p.owner_email),
        city: s(p.location),
        category: s(p.business_type) || "Transport",
        metric: 0,
        status: p.status,
        verified: !!p.verified,
        created_at: p.created_at,
      })),
    setStatus: setProviderStatus,
    setVerified: setProviderVerified,
  },
  {
    id: "roadside",
    name: "Roadside Assistance",
    icon: "Wrench",
    live: true,
    table: "roadside_providers",
    bookingTable: "roadside_requests",
    metricLabel: "—",
    addHref: "/roadside",
    load: async () =>
      (await getAllRoadsideProviders()).map((p) => ({
        id: p.id,
        business: p.business_name,
        ownerEmail: s(p.owner_email),
        city: s(p.city),
        category: "Roadside",
        metric: 0,
        status: p.status,
        verified: !!p.verified,
        created_at: p.created_at,
      })),
    setStatus: setRoadsideProviderStatus,
    setVerified: setRoadsideProviderVerified,
    remove: deleteRoadsideProvider,
  },
  {
    id: "coworking",
    name: "Co-working Spaces",
    icon: "Briefcase",
    live: true,
    table: "coworking_spaces",
    bookingTable: "coworking_bookings",
    metricLabel: "Seats",
    addHref: "/coworking",
    load: async () =>
      (await getAllCoworking()).map((c) => ({
        id: c.id,
        business: c.name,
        ownerEmail: s(c.owner_email),
        city: s(c.city),
        category: "Co-working",
        metric: Number(c.seating_capacity ?? 0),
        status: c.status,
        verified: !!c.verified,
        created_at: c.created_at,
      })),
    setStatus: setCoworkingStatus,
    setVerified: setCoworkingVerified,
    remove: deleteCoworking,
  },
  {
    id: "activities",
    name: "Activities",
    icon: "Mountain",
    live: true,
    table: "activities",
    bookingTable: "activity_bookings",
    metricLabel: "Price",
    addHref: "/activities",
    load: async () =>
      (await getAllActivities()).map((a) => ({
        id: a.id,
        business: a.title,
        ownerEmail: s(a.owner_email),
        city: s(a.city || a.location),
        category: s(a.category) || "Activity",
        metric: Number(a.price ?? 0),
        status: a.status,
        verified: !!a.verified,
        created_at: a.created_at,
      })),
    setStatus: setActivityStatus,
    setVerified: setActivityVerified,
    remove: deleteActivity,
  },
  {
    id: "events",
    name: "Events & Expo",
    icon: "CalendarDays",
    live: true,
    table: "events",
    metricLabel: "Price",
    addHref: "#",
    load: async () =>
      (await getAllEvents()).map((e) => ({
        id: e.id,
        business: e.title,
        ownerEmail: "",
        city: s(e.city),
        category: s(e.category) || "Event",
        metric: Number(e.ticket_price ?? 0),
        status: e.status,
        verified: true,
        created_at: e.created_at,
      })),
    setStatus: setEventStatus,
    remove: deleteEvent,
  },
  // ---- Not yet built (no backend) — shown as "Coming soon" cards ----
  { id: "drone", name: "Drone Camera Services", icon: "Plane", live: false, table: "", metricLabel: "", addHref: "/categories/drone-pilots" },
  { id: "shops", name: "Local Shops / Products", icon: "Store", live: false, table: "", metricLabel: "", addHref: "#" },
  { id: "repair", name: "Repair Services", icon: "Wrench", live: false, table: "", metricLabel: "", addHref: "#" },
];

export interface ModuleStats {
  owners: number;
  listings: number;
  pending: number;
  approved: number;
  suspended: number;
  bookings: number;
}

export function statsFromRows(rows: AdminRow[]): Omit<ModuleStats, "bookings"> {
  return {
    owners: new Set(rows.map((r) => r.ownerEmail).filter(Boolean)).size,
    listings: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    suspended: rows.filter((r) => r.status === "suspended").length,
  };
}

export async function bookingCount(table?: string): Promise<number> {
  if (!table || !isSupabaseConfigured) return 0;
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
  return count ?? 0;
}

/** CSV of the visible rows for the Export button. */
export function rowsToCsv(rows: AdminRow[]): string {
  const head = ["ID", "Business", "Owner Email", "City", "Category", "Metric", "Status", "Verified", "Registered"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.id, r.business, r.ownerEmail, r.city, r.category, String(r.metric), r.status, r.verified ? "Yes" : "No", r.created_at]
      .map((v) => esc(s(v)))
      .join(",")
  );
  return [head.map(esc).join(","), ...lines].join("\n");
}
