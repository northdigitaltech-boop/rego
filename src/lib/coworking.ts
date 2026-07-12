import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";

/* ============================================================
 * Co-working Spaces data layer
 * Matches supabase/phase37-coworking.sql
 * ============================================================ */

export const COWORKING_AMENITIES = [
  "High-speed WiFi",
  "Meeting rooms",
  "Private cabins",
  "Coffee & tea",
  "Printing / scanning",
  "24/7 access",
  "Parking",
  "Air conditioning",
  "Power backup",
  "Lockers",
  "Reception",
  "Mountain view",
];

export const PLAN_TYPES = [
  { slug: "hot-desk", name: "Hot Desk (per day)" },
  { slug: "dedicated-desk", name: "Dedicated Desk (per month)" },
  { slug: "private-office", name: "Private Office (per month)" },
  { slug: "meeting-room", name: "Meeting Room (per hour)" },
  { slug: "day-pass", name: "Day Pass" },
] as const;

export function planName(slug: string): string {
  return PLAN_TYPES.find((p) => p.slug === slug)?.name ?? slug;
}

export interface CoworkingSpaceRow {
  id: string;
  owner_email: string | null;
  name: string;
  owner_name: string | null;
  logo: string | null;
  cover_image: string | null;
  gallery: string[] | null;
  description: string | null;
  city: string | null;
  location: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  amenities: string[] | null;
  wifi_speed: string | null;
  opening_hours: string | null;
  seating_capacity: number | null;
  hot_desk_price: number | null;
  dedicated_desk_price: number | null;
  private_office_price: number | null;
  meeting_room_price: number | null;
  day_pass_available: boolean;
  monthly_available: boolean;
  map_link: string | null;
  social_links: string[] | null;
  rating: number;
  reviews: number;
  verified: boolean;
  featured: boolean;
  ranking_badge: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CoworkingBookingRow {
  id: string;
  space_id: string | null;
  space_name: string | null;
  owner_email: string | null;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  plan_type: string | null;
  start_date: string | null;
  duration: string | null;
  people: number;
  notes: string | null;
  status: string;
  created_at: string;
}

const PUBLIC_COLS =
  "id,owner_email,name,owner_name,logo,cover_image,gallery,description,city,location,address,phone,whatsapp,email,amenities,wifi_speed,opening_hours,seating_capacity,hot_desk_price,dedicated_desk_price,private_office_price,meeting_room_price,day_pass_available,monthly_available,map_link,social_links,rating,reviews,verified,featured,ranking_badge,status,created_at,updated_at";

/* ---------------- Spaces ---------------- */

export async function getCoworkingByOwner(
  email: string
): Promise<CoworkingSpaceRow | null> {
  if (!isSupabaseConfigured || !email) return null;
  const { data } = await supabase
    .from("coworking_spaces")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CoworkingSpaceRow) ?? null;
}

export async function getCoworkingById(id: string): Promise<CoworkingSpaceRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data } = await supabase
    .from("coworking_spaces")
    .select(PUBLIC_COLS)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as CoworkingSpaceRow) ?? null;
}

export async function getApprovedCoworking(): Promise<CoworkingSpaceRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("coworking_spaces")
    .select(PUBLIC_COLS)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("rating", { ascending: false });
  return (data as unknown as CoworkingSpaceRow[]) ?? [];
}

export async function getAllCoworking(): Promise<CoworkingSpaceRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("coworking_spaces")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as CoworkingSpaceRow[]) ?? [];
}

export type CoworkingInput = Partial<
  Omit<CoworkingSpaceRow, "id" | "created_at" | "updated_at">
> & { name: string };

export async function createCoworking(input: CoworkingInput) {
  return supabase.from("coworking_spaces").insert(input).select().single();
}
export async function updateCoworking(id: string, input: Partial<CoworkingInput>) {
  return supabase
    .from("coworking_spaces")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function deleteCoworking(id: string) {
  return supabase.from("coworking_spaces").delete().eq("id", id);
}
export async function setCoworkingStatus(id: string, status: string) {
  return supabase
    .from("coworking_spaces")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function setCoworkingVerified(id: string, verified: boolean) {
  return supabase.from("coworking_spaces").update({ verified }).eq("id", id);
}
export async function setCoworkingFeatured(id: string, featured: boolean) {
  return supabase.from("coworking_spaces").update({ featured }).eq("id", id);
}

/** Cheapest headline price for a card ("From …/day"). */
export function fromPrice(s: CoworkingSpaceRow): { amount: number; unit: string } | null {
  if (s.hot_desk_price != null && s.hot_desk_price > 0)
    return { amount: Number(s.hot_desk_price), unit: "day" };
  if (s.dedicated_desk_price != null && s.dedicated_desk_price > 0)
    return { amount: Number(s.dedicated_desk_price), unit: "month" };
  if (s.private_office_price != null && s.private_office_price > 0)
    return { amount: Number(s.private_office_price), unit: "month" };
  if (s.meeting_room_price != null && s.meeting_room_price > 0)
    return { amount: Number(s.meeting_room_price), unit: "hour" };
  return null;
}

/* ---------------- Bookings / inquiries ---------------- */

export type CoworkingBookingInput = {
  space_id: string | null;
  space_name: string | null;
  owner_email: string | null;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  plan_type: string | null;
  start_date: string | null;
  duration: string | null;
  people: number;
  notes: string | null;
};

export async function createCoworkingBooking(input: CoworkingBookingInput) {
  return supabase.from("coworking_bookings").insert(input).select().single();
}

export async function getCoworkingBookingsByOwner(
  email: string
): Promise<CoworkingBookingRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("coworking_bookings")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  return (data as CoworkingBookingRow[]) ?? [];
}

export async function getAllCoworkingBookings(): Promise<CoworkingBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("coworking_bookings")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as CoworkingBookingRow[]) ?? [];
}

export async function getCoworkingBookingsByCustomer(
  email: string
): Promise<CoworkingBookingRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("coworking_bookings")
    .select("*")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  return (data as CoworkingBookingRow[]) ?? [];
}

export async function setCoworkingBookingStatus(
  id: string,
  status: "accepted" | "rejected" | "completed"
) {
  return supabase.from("coworking_bookings").update({ status }).eq("id", id);
}

export async function hasAcceptedCoworkingBooking(
  email: string,
  spaceId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !spaceId) return false;
  const { data } = await supabase
    .from("coworking_bookings")
    .select("id")
    .eq("customer_email", email)
    .eq("space_id", spaceId)
    .in("status", ["accepted", "completed"])
    .limit(1)
    .maybeSingle();
  return !!data;
}

export function coworkingBookingRef(id: string) {
  return "CWS-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
