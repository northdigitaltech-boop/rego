import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Live platform stats for the homepage band. Real row counts from the
 * database — updates automatically as providers register and bookings
 * happen. No fake numbers.
 * ============================================================ */

async function countRows(table: string, approvedOnly = false): Promise<number> {
  try {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    if (approvedOnly) q = q.eq("status", "approved");
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export interface PlatformStat {
  label: string;
  value: number;
}

/** Every booking/request table on the platform (missing tables count as 0). */
const BOOKING_TABLES = [
  "bookings",
  "homestay_bookings",
  "hostel_bookings",
  "tour_bookings",
  "transport_bookings",
  "guide_bookings",
  "media_bookings",
  "restaurant_bookings",
  "activity_bookings",
  "coworking_bookings",
  "roadside_requests",
];

/** Every listing table on the platform (missing tables count as 0). */
const LISTING_TABLES = [
  "hotels",
  "homestays",
  "hostels",
  "tour_companies",
  "tour_guides",
  "tour_packages",
  "transport_providers",
  "media_providers",
  "restaurants",
  "activities",
  "expedition_companies",
  "roadside_providers",
];

export interface AdminOverviewStats {
  listings: number;
  users: number;
  bookings: number;
}

/**
 * Real counts for the admin overview cards. Replaces the old hardcoded
 * placeholder figures — these move as the platform actually grows.
 */
export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  if (!isSupabaseConfigured) return { listings: 0, users: 0, bookings: 0 };
  const listingCounts = await Promise.all(LISTING_TABLES.map((t) => countRows(t)));
  const bookingCounts = await Promise.all(BOOKING_TABLES.map((t) => countRows(t)));
  const users = await countRows("profiles");
  return {
    listings: listingCounts.reduce((a, b) => a + b, 0),
    users,
    bookings: bookingCounts.reduce((a, b) => a + b, 0),
  };
}

export async function getPlatformStats(): Promise<PlatformStat[]> {
  if (!isSupabaseConfigured) return [];
  const [hotels, homestays, hostels, companies, guides, expeditionCos, ...bookingCounts] =
    await Promise.all([
      countRows("hotels", true),
      countRows("homestays", true),
      countRows("hostels", true),
      countRows("tour_companies", true),
      countRows("tour_guides", true),
      countRows("expedition_companies", true),
      ...BOOKING_TABLES.map((t) => countRows(t)),
    ]);
  const bookings = bookingCounts.reduce((a, b) => a + b, 0);

  return [
    { label: "Hotels & Stays", value: hotels + homestays + hostels },
    { label: "Tour & Expedition Companies", value: companies + expeditionCos },
    { label: "Local Guides", value: guides },
    { label: "Bookings Made", value: bookings },
  ];
}
