import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";
import { type Listing } from "@/lib/data";
import { updateOrQueue } from "@/lib/pending-edits";

/* ---------------- Row types (match supabase/phase48-hostels.sql) ---------------- */

export interface HostelRow {
  id: string;
  title: string;
  category: string;
  category_label: string;
  location: string;
  address: string | null;
  map_link: string | null;
  price: number;
  unit: string;
  rating: number;
  reviews: number;
  image: string | null;
  description: string | null;
  amenities: string[] | null;
  gallery: string[] | null;
  checkin_time: string | null;
  checkout_time: string | null;
  house_rules: string | null;
  cancellation_policy: string | null;
  blocked_dates: string[] | null;
  maintenance_dates: string[] | null;
  min_stay: number | null;
  max_stay: number | null;
  total_rooms: number;
  featured: boolean;
  status: string; // pending | approved | rejected
  reg_number: string | null;
  license_doc: string | null;
  owner_cnic: string | null;
  owner_cnic_doc: string | null;
  ownership_doc: string | null;
  verified: boolean;
  ranking_badge?: string | null;
  owner_email: string | null;
  created_at: string;
}

export interface HostelRoomRow {
  id: string;
  hostel_id: string;
  name: string;
  room_type: string | null;
  total_units: number;
  max_guests: number;
  beds: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  room_size: string | null;
  price: number;
  weekend_price: number | null;
  seasonal_price: number | null;
  extra_guest_charges: number | null;
  images: string[] | null;
  description: string | null;
  amenities: string[] | null;
  created_at: string;
}

// Columns safe for the public/customer side — EXCLUDES verification documents.
const PUBLIC_HOSTEL_COLUMNS =
  "id,title,category,category_label,location,address,map_link,price,unit,rating,reviews,image,description,amenities,gallery,checkin_time,checkout_time,house_rules,cancellation_policy,blocked_dates,maintenance_dates,min_stay,max_stay,total_rooms,featured,status,verified,ranking_badge,owner_email,created_at,accept_pay_at_property,require_advance_payment,advance_payment_percentage,accepted_payment_methods,payment_bank_name,payment_account_title,payment_account_number,payment_iban,payment_jazzcash,payment_easypaisa,payment_instructions";

/** Map a database hostel row to the shared Listing shape used by the UI. */
export function hostelToListing(h: HostelRow): Listing {
  return {
    id: h.id,
    title: h.title,
    category: "hostels",
    categoryLabel: h.category_label || "Hostel",
    location: h.location,
    price: h.price,
    unit: h.unit,
    rating: Number(h.rating),
    reviews: h.reviews,
    image: h.image || "https://picsum.photos/seed/hostel/900/600",
    featured: h.featured,
  };
}

/* ---------------- Public reads ---------------- */

/** Approved hostels for the public site. Returns [] if not configured. */
export async function getHostels(): Promise<Listing[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hostels")
    .select(PUBLIC_HOSTEL_COLUMNS)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getHostels error:", error.message);
    return [];
  }
  return (data as unknown as HostelRow[]).map(hostelToListing);
}

export async function getHostelById(id: string): Promise<Listing | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("hostels")
    .select(PUBLIC_HOSTEL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return hostelToListing(data as unknown as HostelRow);
}

/** Full public row (no verification docs) for the customer detail page. */
export async function getHostelRowById(
  id: string
): Promise<HostelRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("hostels")
    .select(PUBLIC_HOSTEL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as HostelRow;
}

/* ---------------- Owner / admin reads ---------------- */

export async function getHostelsByOwner(
  email: string
): Promise<HostelRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hostels")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getHostelsByOwner error:", error.message);
    return [];
  }
  return (data as HostelRow[]) ?? [];
}

export async function getPendingHostels(): Promise<HostelRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hostels")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getPendingHostels error:", error.message);
    return [];
  }
  return (data as HostelRow[]) ?? [];
}

/** All hostels (any status) — used by the admin verification screen. */
export async function getAllHostels(): Promise<HostelRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hostels")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllHostels error:", error.message);
    return [];
  }
  return (data as HostelRow[]) ?? [];
}

export async function setHostelStatus(
  id: string,
  status: "approved" | "rejected" | "pending"
) {
  return supabase.from("hostels").update({ status }).eq("id", id);
}

export async function setHostelVerified(id: string, verified: boolean) {
  return supabase.from("hostels").update({ verified }).eq("id", id);
}

/** Feature / unfeature a hostel on the homepage (admin only). */
export async function setHostelFeatured(id: string, featured: boolean) {
  return supabase.from("hostels").update({ featured }).eq("id", id);
}

/* ---------------- Write operations ---------------- */

export interface HostelInput {
  title: string;
  category_label?: string;
  location: string;
  address?: string | null;
  map_link?: string | null;
  price: number;
  unit?: string;
  image?: string | null;
  description?: string | null;
  amenities?: string[];
  gallery?: string[];
  checkin_time?: string | null;
  checkout_time?: string | null;
  house_rules?: string | null;
  cancellation_policy?: string | null;
  blocked_dates?: string[];
  maintenance_dates?: string[];
  min_stay?: number | null;
  max_stay?: number | null;
  total_rooms?: number;
  featured?: boolean;
  reg_number?: string | null;
  license_doc?: string | null;
  owner_cnic?: string | null;
  owner_cnic_doc?: string | null;
  ownership_doc?: string | null;
  owner_email: string;
}

export async function createHostel(input: HostelInput) {
  return supabase
    .from("hostels")
    .insert({ ...input, category: "hostels" })
    .select()
    .single();
}

export async function updateHostel(id: string, input: Partial<HostelInput>) {
  return updateOrQueue("hostels", id, input as Record<string, unknown>);
}

export async function deleteHostel(id: string) {
  return supabase.from("hostels").delete().eq("id", id);
}

/* ---------------- Rooms (embedded in the listing form) ---------------- */

export interface HostelRoomInput {
  hostel_id: string;
  name: string;
  room_type?: string | null;
  total_units?: number;
  max_guests?: number;
  beds?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  room_size?: string | null;
  price: number;
  weekend_price?: number | null;
  seasonal_price?: number | null;
  extra_guest_charges?: number | null;
  images?: string[];
  description?: string | null;
  amenities?: string[];
}

export async function getRoomsByHostel(
  hostelId: string
): Promise<HostelRoomRow[]> {
  if (!isSupabaseConfigured || !isUuid(hostelId)) return [];
  const { data, error } = await supabase
    .from("hostel_rooms")
    .select("*")
    .eq("hostel_id", hostelId)
    .order("price", { ascending: true });
  if (error) {
    console.error("getRoomsByHostel error:", error.message);
    return [];
  }
  return (data as HostelRoomRow[]) ?? [];
}

export async function addHostelRoom(input: HostelRoomInput) {
  return supabase.from("hostel_rooms").insert(input);
}

export async function deleteHostelRoomsFor(hostelId: string) {
  return supabase.from("hostel_rooms").delete().eq("hostel_id", hostelId);
}

/**
 * Replace all rooms for a hostel with the provided set. Used by the embedded
 * room configuration so the owner manages everything from the listing form.
 */
export async function replaceHostelRooms(
  hostelId: string,
  rooms: Omit<HostelRoomInput, "hostel_id">[]
) {
  if (!isSupabaseConfigured || !isUuid(hostelId)) return;
  await deleteHostelRoomsFor(hostelId);
  if (rooms.length === 0) return;
  await supabase
    .from("hostel_rooms")
    .insert(rooms.map((r) => ({ ...r, hostel_id: hostelId })));
}

/* ---------------- Inventory / availability ---------------- */

export interface HostelBookingRoomRow {
  id: string;
  booking_id: string;
  room_id: string | null;
  hostel_id: string | null;
  room_name: string | null;
  units: number;
  check_in: string | null;
  check_out: string | null;
  status: string;
  created_at: string;
}

function overlaps(
  aIn: string | null,
  aOut: string | null,
  bIn: string,
  bOut: string
) {
  return !!aIn && !!aOut && aIn < bOut && aOut > bIn;
}

/** Units already reserved/booked for a hostel room over a date range. */
export async function getHostelRoomBookedUnits(
  roomId: string,
  checkIn: string,
  checkOut: string
): Promise<number> {
  if (!isSupabaseConfigured || !isUuid(roomId) || !checkIn || !checkOut)
    return 0;
  const { data, error } = await supabase
    .from("hostel_booking_rooms")
    .select("units, check_in, check_out, status")
    .eq("room_id", roomId)
    .in("status", ["pending", "accepted"]);
  if (error || !data) return 0;
  return (data as HostelBookingRoomRow[])
    .filter((b) => overlaps(b.check_in, b.check_out, checkIn, checkOut))
    .reduce((s, b) => s + (b.units || 0), 0);
}

export async function addHostelBookingRoom(input: {
  booking_id: string;
  room_id: string | null;
  hostel_id: string | null;
  room_name: string;
  units: number;
  check_in: string | null;
  check_out: string | null;
}) {
  return supabase
    .from("hostel_booking_rooms")
    .insert({ ...input, status: "pending" });
}

export async function setHostelBookingRoomsStatus(
  bookingId: string,
  status: "accepted" | "rejected"
) {
  return supabase
    .from("hostel_booking_rooms")
    .update({ status })
    .eq("booking_id", bookingId);
}

export async function getBookingRoomsForHostels(
  hostelIds: string[]
): Promise<HostelBookingRoomRow[]> {
  if (!isSupabaseConfigured || hostelIds.length === 0) return [];
  const { data, error } = await supabase
    .from("hostel_booking_rooms")
    .select("*")
    .in("hostel_id", hostelIds);
  if (error) {
    console.error("getBookingRoomsForHostels error:", error.message);
    return [];
  }
  return (data as HostelBookingRoomRow[]) ?? [];
}
