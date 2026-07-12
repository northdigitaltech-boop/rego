import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface HostelBookingRow {
  id: string;
  hostel_id: string | null;
  hostel_title: string;
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

export interface HostelBookingInput {
  hostel_id: string | null;
  hostel_title: string;
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
export function hostelBookingRef(id: string) {
  return "SGB-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function createHostelBooking(input: HostelBookingInput) {
  return supabase.from("hostel_bookings").insert(input).select().single();
}

export async function getHostelBookingsByCustomer(
  email: string
): Promise<HostelBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hostel_bookings")
    .select("*")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getHostelBookingsByCustomer error:", error.message);
    return [];
  }
  return (data as HostelBookingRow[]) ?? [];
}

export async function getHostelBookingsByOwner(
  email: string
): Promise<HostelBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hostel_bookings")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getHostelBookingsByOwner error:", error.message);
    return [];
  }
  return (data as HostelBookingRow[]) ?? [];
}

export async function setHostelBookingStatus(
  id: string,
  status: "accepted" | "rejected"
) {
  return supabase.from("hostel_bookings").update({ status }).eq("id", id);
}

/** Whether the user has a confirmed booking for a hostel — gates reviews. */
export async function hasAcceptedHostelBooking(
  email: string,
  hostelId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !hostelId) return false;
  const { data } = await supabase
    .from("hostel_bookings")
    .select("id")
    .eq("customer_email", email)
    .eq("hostel_id", hostelId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** All hostel booking ids where the user is the customer OR the owner. */
export async function getHostelBookingIdsForUser(
  email: string
): Promise<string[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data, error } = await supabase
    .from("hostel_bookings")
    .select("id")
    .or(`customer_email.eq.${email},owner_email.eq.${email}`);
  if (error) {
    console.error("getHostelBookingIdsForUser error:", error.message);
    return [];
  }
  return (data as { id: string }[]).map((r) => r.id);
}
