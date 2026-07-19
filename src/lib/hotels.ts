import {
  supabase,
  isSupabaseConfigured,
  type HotelRow,
  type RoomRow,
} from "@/lib/supabase";
import { updateOrQueue } from "@/lib/pending-edits";
import { type Listing } from "@/lib/data";

export function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

/** Map a database hotel row to the shared Listing shape used by the UI. */
export function rowToListing(h: HotelRow): Listing {
  return {
    id: h.id,
    title: h.title,
    category: (h.category as Listing["category"]) || "hotels",
    categoryLabel: h.category_label,
    location: h.location,
    price: h.price,
    unit: h.unit,
    rating: Number(h.rating),
    reviews: h.reviews,
    image: h.image || "https://loremflickr.com/900/600/hotel,mountain",
    featured: h.featured,
  };
}

// Columns safe to expose to the public/customer side. Deliberately EXCLUDES
// the verification documents and owner ID (reg_number, license_doc,
// owner_cnic, owner_cnic_doc, ownership_doc) so they never reach the browser.
const PUBLIC_HOTEL_COLUMNS =
  "id,title,category,category_label,location,price,unit,rating,reviews,image,description,amenities,gallery,featured,status,total_rooms,address,verified,ranking_badge,owner_email,created_at,accept_pay_at_property,require_advance_payment,advance_payment_percentage,accepted_payment_methods,payment_bank_name,payment_account_title,payment_account_number,payment_iban,payment_jazzcash,payment_easypaisa,payment_instructions";

/** Fetch APPROVED hotels for the public site. Returns [] if not configured. */
export async function getHotels(): Promise<Listing[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hotels")
    .select(PUBLIC_HOTEL_COLUMNS)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getHotels error:", error.message);
    return [];
  }
  return (data as unknown as HotelRow[]).map(rowToListing);
}

/** Hotels awaiting admin review. */
export async function getPendingHotels(): Promise<HotelRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getPendingHotels error:", error.message);
    return [];
  }
  return (data as HotelRow[]) ?? [];
}

export async function setHotelStatus(
  id: string,
  status: string
) {
  return supabase.from("hotels").update({ status }).eq("id", id);
}

/** All hotels (any status) — used by the admin verification screen. */
export async function getAllHotels(): Promise<HotelRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllHotels error:", error.message);
    return [];
  }
  return (data as HotelRow[]) ?? [];
}

/** Mark a property's documents as verified (or revoke verification). */
export async function setHotelVerified(id: string, verified: boolean) {
  return supabase.from("hotels").update({ verified }).eq("id", id);
}

/** Feature / unfeature a hotel on the homepage (admin only). */
export async function setHotelFeatured(id: string, featured: boolean) {
  return supabase.from("hotels").update({ featured }).eq("id", id);
}

/** Fetch a single hotel by id. Returns null if not found or not configured. */
export async function getHotelById(id: string): Promise<Listing | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("hotels")
    .select(PUBLIC_HOTEL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToListing(data as unknown as HotelRow);
}

/* ---------------- Provider write operations (Phase 2) ---------------- */

export interface HotelInput {
  title: string;
  category_label: string;
  location: string;
  price: number;
  unit: string;
  rating?: number;
  reviews?: number;
  image?: string | null;
  description?: string | null;
  amenities?: string[];
  gallery?: string[];
  total_rooms?: number;
  address?: string | null;
  reg_number?: string | null;
  license_doc?: string | null;
  owner_cnic?: string | null;
  owner_cnic_doc?: string | null;
  ownership_doc?: string | null;
  featured?: boolean;
  owner_email: string;
}

/** Raw hotel row by id (includes amenities + description for the profile). */
export async function getHotelRowById(id: string): Promise<HotelRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  // Public column allowlist — verification docs are never sent to customers.
  const { data, error } = await supabase
    .from("hotels")
    .select(PUBLIC_HOTEL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as HotelRow;
}

/* ---------------- Rooms ---------------- */

export interface RoomInput {
  hotel_id: string;
  name: string;
  room_type?: string;
  price: number;
  guests: number;
  beds: string;
  features: string[];
  images?: string[];
  total_units?: number;
}

export async function getRoomsByHotel(hotelId: string): Promise<RoomRow[]> {
  if (!isSupabaseConfigured || !isUuid(hotelId)) return [];
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("price", { ascending: true });
  if (error) {
    console.error("getRoomsByHotel error:", error.message);
    return [];
  }
  return (data as RoomRow[]) ?? [];
}

export async function addRoom(input: RoomInput) {
  return supabase.from("rooms").insert(input);
}

export async function deleteRoom(id: string) {
  return supabase.from("rooms").delete().eq("id", id);
}

/* ---------------- Inventory / availability ---------------- */

export interface BookingRoomRow {
  id: string;
  booking_id: string;
  room_id: string | null;
  hotel_id: string | null;
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

/** Units already reserved/booked for a room over a date range. */
export async function getRoomBookedUnits(
  roomId: string,
  checkIn: string,
  checkOut: string
): Promise<number> {
  if (!isSupabaseConfigured || !isUuid(roomId) || !checkIn || !checkOut) return 0;
  const { data, error } = await supabase
    .from("booking_rooms")
    .select("units, check_in, check_out, status")
    .eq("room_id", roomId)
    .in("status", ["pending", "accepted"]);
  if (error || !data) return 0;
  return (data as BookingRoomRow[])
    .filter((b) => overlaps(b.check_in, b.check_out, checkIn, checkOut))
    .reduce((s, b) => s + (b.units || 0), 0);
}

export async function addBookingRoom(input: {
  booking_id: string;
  room_id: string | null;
  hotel_id: string | null;
  room_name: string;
  units: number;
  check_in: string | null;
  check_out: string | null;
}) {
  return supabase.from("booking_rooms").insert({ ...input, status: "pending" });
}

export async function setBookingRoomsStatus(
  bookingId: string,
  status: "accepted" | "rejected"
) {
  return supabase
    .from("booking_rooms")
    .update({ status })
    .eq("booking_id", bookingId);
}

/** All booking-room lines for a set of hotels (owner inventory + analytics). */
export async function getBookingRoomsForHotels(
  hotelIds: string[]
): Promise<BookingRoomRow[]> {
  if (!isSupabaseConfigured || hotelIds.length === 0) return [];
  const { data, error } = await supabase
    .from("booking_rooms")
    .select("*")
    .in("hotel_id", hotelIds);
  if (error) {
    console.error("getBookingRoomsForHotels error:", error.message);
    return [];
  }
  return (data as BookingRoomRow[]) ?? [];
}

/** All hotels owned by a given provider email (raw rows, newest first). */
export async function getHotelsByOwner(email: string): Promise<HotelRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getHotelsByOwner error:", error.message);
    return [];
  }
  return (data as HotelRow[]) ?? [];
}

export async function createHotel(input: HotelInput) {
  return supabase
    .from("hotels")
    .insert({ ...input, category: "hotels" })
    .select()
    .single();
}

export async function updateHotel(id: string, input: Partial<HotelInput>) {
  return updateOrQueue("hotels", id, input as Record<string, unknown>);
}

export async function deleteHotel(id: string) {
  return supabase.from("hotels").delete().eq("id", id);
}
