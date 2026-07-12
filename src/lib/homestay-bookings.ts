import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface HomestayBookingRow {
  id: string;
  homestay_id: string | null;
  homestay_title: string;
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

export interface HomestayBookingInput {
  homestay_id: string | null;
  homestay_title: string;
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
export function homestayBookingRef(id: string) {
  return "SGB-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function createHomestayBooking(input: HomestayBookingInput) {
  return supabase.from("homestay_bookings").insert(input).select().single();
}

export async function getHomestayBookingsByCustomer(
  email: string
): Promise<HomestayBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("homestay_bookings")
    .select("*")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getHomestayBookingsByCustomer error:", error.message);
    return [];
  }
  return (data as HomestayBookingRow[]) ?? [];
}

export async function getHomestayBookingsByOwner(
  email: string
): Promise<HomestayBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("homestay_bookings")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getHomestayBookingsByOwner error:", error.message);
    return [];
  }
  return (data as HomestayBookingRow[]) ?? [];
}

export async function setHomestayBookingStatus(
  id: string,
  status: "accepted" | "rejected"
) {
  return supabase.from("homestay_bookings").update({ status }).eq("id", id);
}

/** Whether the user has a confirmed booking for a homestay — gates reviews. */
export async function hasAcceptedHomestayBooking(
  email: string,
  homestayId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !homestayId) return false;
  const { data } = await supabase
    .from("homestay_bookings")
    .select("id")
    .eq("customer_email", email)
    .eq("homestay_id", homestayId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** All homestay booking ids where the user is the customer OR the owner. */
export async function getHomestayBookingIdsForUser(
  email: string
): Promise<string[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data, error } = await supabase
    .from("homestay_bookings")
    .select("id")
    .or(`customer_email.eq.${email},owner_email.eq.${email}`);
  if (error) {
    console.error("getHomestayBookingIdsForUser error:", error.message);
    return [];
  }
  return (data as { id: string }[]).map((r) => r.id);
}
