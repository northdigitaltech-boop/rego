import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface BookingRow {
  id: string;
  hotel_id: string | null;
  hotel_title: string;
  room_name: string | null;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_city: string | null;
  notes: string | null;
  owner_email: string | null;
  check_in: string | null;
  check_out: string | null;
  guests: number;
  rooms: number;
  total_price: number;
  status: string; // pending | accepted | rejected
  created_at: string;
}

export interface BookingInput {
  hotel_id: string | null;
  hotel_title: string;
  room_name: string | null;
  customer_email: string;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_city?: string | null;
  notes?: string | null;
  owner_email: string | null;
  check_in: string | null;
  check_out: string | null;
  guests: number;
  rooms?: number;
  total_price: number;
}

/** Human-friendly booking reference, e.g. SGB-A1B2C3D4 */
export function bookingRef(id: string) {
  return "SGB-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function createBooking(input: BookingInput) {
  return supabase.from("bookings").insert(input).select().single();
}

export async function getBookingsByCustomer(
  email: string
): Promise<BookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getBookingsByCustomer error:", error.message);
    return [];
  }
  return (data as BookingRow[]) ?? [];
}

export async function getBookingsByOwner(email: string): Promise<BookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getBookingsByOwner error:", error.message);
    return [];
  }
  return (data as BookingRow[]) ?? [];
}

export async function setBookingStatus(
  id: string,
  status: "accepted" | "rejected"
) {
  return supabase.from("bookings").update({ status }).eq("id", id);
}

/** Whether the user has a confirmed (accepted) booking for a hotel — gates reviews. */
export async function hasAcceptedBooking(
  email: string,
  hotelId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !hotelId) return false;
  const { data } = await supabase
    .from("bookings")
    .select("id")
    .eq("customer_email", email)
    .eq("hotel_id", hotelId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** All booking ids where the user is the customer OR the owner. */
export async function getBookingIdsForUser(email: string): Promise<string[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .or(`customer_email.eq.${email},owner_email.eq.${email}`);
  if (error) {
    console.error("getBookingIdsForUser error:", error.message);
    return [];
  }
  return (data as { id: string }[]).map((r) => r.id);
}
