import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface TourBookingRow {
  id: string;
  company_id: string | null;
  item_type: string; // package | transport | guide
  item_id: string | null;
  item_title: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_city: string | null;
  notes: string | null;
  owner_email: string | null;
  start_date: string | null;
  end_date: string | null;
  guests: number;
  total_price: number;
  status: string; // pending | accepted | rejected
  created_at: string;
}

export interface TourBookingInput {
  company_id: string | null;
  item_type: "package" | "transport" | "guide";
  item_id: string | null;
  item_title: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_city?: string | null;
  notes?: string | null;
  owner_email: string | null;
  start_date: string | null;
  end_date: string | null;
  guests: number;
  total_price: number;
}

/** Human-friendly booking reference, e.g. SGB-A1B2C3D4 */
export function tourBookingRef(id: string) {
  return "SGB-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function createTourBooking(input: TourBookingInput) {
  return supabase.from("tour_bookings").insert(input).select().single();
}

export async function getTourBookingsByOwner(
  email: string
): Promise<TourBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("tour_bookings")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getTourBookingsByOwner error:", error.message);
    return [];
  }
  return (data as TourBookingRow[]) ?? [];
}

export async function getTourBookingsByCustomer(
  email: string
): Promise<TourBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("tour_bookings")
    .select("*")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  return (data as TourBookingRow[]) ?? [];
}

export async function setTourBookingStatus(
  id: string,
  status: "accepted" | "rejected"
) {
  return supabase.from("tour_bookings").update({ status }).eq("id", id);
}

/**
 * Get (or create) a private in-app conversation thread between a customer and a
 * tour company, so customers can message a company before booking. Reuses the
 * tour_bookings table with item_type = "inquiry".
 */
export async function getOrCreateInquiry(opts: {
  companyId: string;
  companyName: string;
  ownerEmail: string | null;
  customerEmail: string;
  customerName: string;
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data: existing } = await supabase
    .from("tour_bookings")
    .select("id")
    .eq("company_id", opts.companyId)
    .eq("customer_email", opts.customerEmail)
    .eq("item_type", "inquiry")
    .limit(1)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  const { data, error } = await supabase
    .from("tour_bookings")
    .insert({
      company_id: opts.companyId,
      item_type: "inquiry",
      item_id: null,
      item_title: `Inquiry · ${opts.companyName}`,
      customer_email: opts.customerEmail,
      customer_name: opts.customerName,
      owner_email: opts.ownerEmail,
      start_date: null,
      end_date: null,
      guests: 0,
      total_price: 0,
      status: "inquiry",
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** Whether the user has a confirmed booking for a tour item — gates reviews. */
export async function hasAcceptedTourBooking(
  email: string,
  itemId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !itemId) return false;
  const { data } = await supabase
    .from("tour_bookings")
    .select("id")
    .eq("customer_email", email)
    .eq("item_id", itemId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function getTourBookingIdsForUser(
  email: string
): Promise<string[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("tour_bookings")
    .select("id")
    .or(`customer_email.eq.${email},owner_email.eq.${email}`);
  return (data as { id: string }[] | null)?.map((r) => r.id) ?? [];
}
