import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { CancellationFields } from "@/lib/booking-cancellation";

export interface RestaurantBookingRow extends CancellationFields {
  id: string;
  restaurant_id: string | null;
  property_id: string | null;
  booking_type: string; // table | inquiry
  item_title: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  owner_email: string | null;
  date: string | null;
  time: string | null;
  guests: number;
  status: string;
  created_at: string;
}

export interface RestaurantBookingInput {
  restaurant_id: string | null;
  property_id: string | null;
  booking_type: "table" | "inquiry";
  item_title: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone?: string | null;
  notes?: string | null;
  owner_email: string | null;
  date?: string | null;
  time?: string | null;
  guests: number;
}

export function restaurantBookingRef(id: string) {
  return "SGB-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/* Bookings are confirmed as they are created — the provider is not asked to
   accept first. Set here rather than in each booking form, so no form can be
   added later that quietly leaves one pending.

   Every one of the eight booking tables uses 'accepted' for the confirmed
   state (pending | accepted | rejected [| completed]), so the same literal is
   correct for all of them. The column default is still 'pending', which is
   what an insert from anywhere else will get. */
export async function createRestaurantBooking(input: RestaurantBookingInput) {
  return supabase
    .from("restaurant_bookings")
    .insert({ ...input, status: "accepted" })
    .select()
    .single();
}

export async function getRestaurantBookingsByOwner(email: string): Promise<RestaurantBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("restaurant_bookings")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  return (data as RestaurantBookingRow[]) ?? [];
}

export async function getRestaurantBookingsByCustomer(email: string): Promise<RestaurantBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("restaurant_bookings")
    .select("*")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  return (data as RestaurantBookingRow[]) ?? [];
}

export async function setRestaurantBookingStatus(id: string, status: "accepted" | "rejected") {
  return supabase.from("restaurant_bookings").update({ status }).eq("id", id);
}

export async function hasAcceptedRestaurantBooking(email: string, restaurantId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !restaurantId) return false;
  const { data } = await supabase
    .from("restaurant_bookings")
    .select("id")
    .eq("customer_email", email)
    .eq("restaurant_id", restaurantId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function getRestaurantBookingIdsForUser(email: string): Promise<string[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("restaurant_bookings")
    .select("id")
    .or(`customer_email.eq.${email},owner_email.eq.${email}`);
  return (data as { id: string }[] | null)?.map((r) => r.id) ?? [];
}
