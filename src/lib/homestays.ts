import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";
import { type Listing } from "@/lib/data";
import { updateOrQueue } from "@/lib/pending-edits";

/* ---------------- Row types (match supabase/phase14-homestays.sql) ---------------- */

export interface HomestayRow {
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

export interface HomestayRoomRow {
  id: string;
  homestay_id: string;
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
const PUBLIC_HOMESTAY_COLUMNS =
  "id,title,category,category_label,location,address,map_link,price,unit,rating,reviews,image,description,amenities,gallery,checkin_time,checkout_time,house_rules,cancellation_policy,blocked_dates,maintenance_dates,min_stay,max_stay,total_rooms,featured,status,verified,ranking_badge,owner_email,created_at,accept_pay_at_property,require_advance_payment,advance_payment_percentage,accepted_payment_methods,payment_bank_name,payment_account_title,payment_account_number,payment_iban,payment_jazzcash,payment_easypaisa,payment_instructions";

/** Map a database homestay row to the shared Listing shape used by the UI. */
export function homestayToListing(h: HomestayRow): Listing {
  return {
    id: h.id,
    title: h.title,
    category: "homestays",
    categoryLabel: h.category_label || "Homestay",
    location: h.location,
    price: h.price,
    unit: h.unit,
    rating: Number(h.rating),
    reviews: h.reviews,
    image: h.image || "https://picsum.photos/seed/homestay/900/600",
    featured: h.featured,
  };
}

/* ---------------- Public reads ---------------- */

/** Approved homestays for the public site. Returns [] if not configured. */
export async function getHomestays(): Promise<Listing[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("homestays")
    .select(PUBLIC_HOMESTAY_COLUMNS)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getHomestays error:", error.message);
    return [];
  }
  return (data as unknown as HomestayRow[]).map(homestayToListing);
}

export async function getHomestayById(id: string): Promise<Listing | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("homestays")
    .select(PUBLIC_HOMESTAY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return homestayToListing(data as unknown as HomestayRow);
}

/** Full public row (no verification docs) for the customer detail page. */
export async function getHomestayRowById(
  id: string
): Promise<HomestayRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("homestays")
    .select(PUBLIC_HOMESTAY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as HomestayRow;
}

/* ---------------- Owner / admin reads ---------------- */

export async function getHomestaysByOwner(
  email: string
): Promise<HomestayRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("homestays")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getHomestaysByOwner error:", error.message);
    return [];
  }
  return (data as HomestayRow[]) ?? [];
}

export async function getPendingHomestays(): Promise<HomestayRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("homestays")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getPendingHomestays error:", error.message);
    return [];
  }
  return (data as HomestayRow[]) ?? [];
}

/** All homestays (any status) — used by the admin verification screen. */
export async function getAllHomestays(): Promise<HomestayRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("homestays")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllHomestays error:", error.message);
    return [];
  }
  return (data as HomestayRow[]) ?? [];
}

export async function setHomestayStatus(
  id: string,
  status: string
) {
  return supabase.from("homestays").update({ status }).eq("id", id);
}

export async function setHomestayVerified(id: string, verified: boolean) {
  return supabase.from("homestays").update({ verified }).eq("id", id);
}

/** Feature / unfeature a homestay on the homepage (admin only). */
export async function setHomestayFeatured(id: string, featured: boolean) {
  return supabase.from("homestays").update({ featured }).eq("id", id);
}

/* ---------------- Write operations ---------------- */

export interface HomestayInput {
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

export async function createHomestay(input: HomestayInput) {
  return supabase
    .from("homestays")
    .insert({ ...input, category: "homestays" })
    .select()
    .single();
}

export async function updateHomestay(id: string, input: Partial<HomestayInput>) {
  return updateOrQueue("homestays", id, input as Record<string, unknown>);
}

export async function deleteHomestay(id: string) {
  return supabase.from("homestays").delete().eq("id", id);
}

/* ---------------- Rooms (embedded in the listing form) ---------------- */

export interface HomestayRoomInput {
  homestay_id: string;
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

export async function getRoomsByHomestay(
  homestayId: string
): Promise<HomestayRoomRow[]> {
  if (!isSupabaseConfigured || !isUuid(homestayId)) return [];
  const { data, error } = await supabase
    .from("homestay_rooms")
    .select("*")
    .eq("homestay_id", homestayId)
    .order("price", { ascending: true });
  if (error) {
    console.error("getRoomsByHomestay error:", error.message);
    return [];
  }
  return (data as HomestayRoomRow[]) ?? [];
}

export async function addHomestayRoom(input: HomestayRoomInput) {
  return supabase.from("homestay_rooms").insert(input);
}

export async function deleteHomestayRoomsFor(homestayId: string) {
  return supabase.from("homestay_rooms").delete().eq("homestay_id", homestayId);
}

/**
 * Replace all rooms for a homestay with the provided set. Used by the embedded
 * room configuration so the owner manages everything from the listing form.
 */
export async function replaceHomestayRooms(
  homestayId: string,
  rooms: Omit<HomestayRoomInput, "homestay_id">[]
) {
  if (!isSupabaseConfigured || !isUuid(homestayId)) return;
  await deleteHomestayRoomsFor(homestayId);
  if (rooms.length === 0) return;
  await supabase
    .from("homestay_rooms")
    .insert(rooms.map((r) => ({ ...r, homestay_id: homestayId })));
}

/* ---------------- Inventory / availability ---------------- */

export interface HomestayBookingRoomRow {
  id: string;
  booking_id: string;
  room_id: string | null;
  homestay_id: string | null;
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

/** Units already reserved/booked for a homestay room over a date range. */
export async function getHomestayRoomBookedUnits(
  roomId: string,
  checkIn: string,
  checkOut: string
): Promise<number> {
  if (!isSupabaseConfigured || !isUuid(roomId) || !checkIn || !checkOut)
    return 0;
  const { data, error } = await supabase
    .from("homestay_booking_rooms")
    .select("units, check_in, check_out, status")
    .eq("room_id", roomId)
    .in("status", ["pending", "accepted"]);
  if (error || !data) return 0;
  return (data as HomestayBookingRoomRow[])
    .filter((b) => overlaps(b.check_in, b.check_out, checkIn, checkOut))
    .reduce((s, b) => s + (b.units || 0), 0);
}

export async function addHomestayBookingRoom(input: {
  booking_id: string;
  room_id: string | null;
  homestay_id: string | null;
  room_name: string;
  units: number;
  check_in: string | null;
  check_out: string | null;
}) {
  return supabase
    .from("homestay_booking_rooms")
    .insert({ ...input, status: "pending" });
}

export async function setHomestayBookingRoomsStatus(
  bookingId: string,
  status: "accepted" | "rejected"
) {
  return supabase
    .from("homestay_booking_rooms")
    .update({ status })
    .eq("booking_id", bookingId);
}

export async function getBookingRoomsForHomestays(
  homestayIds: string[]
): Promise<HomestayBookingRoomRow[]> {
  if (!isSupabaseConfigured || homestayIds.length === 0) return [];
  const { data, error } = await supabase
    .from("homestay_booking_rooms")
    .select("*")
    .in("homestay_id", homestayIds);
  if (error) {
    console.error("getBookingRoomsForHomestays error:", error.message);
    return [];
  }
  return (data as HomestayBookingRoomRow[]) ?? [];
}
