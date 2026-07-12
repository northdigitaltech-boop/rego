import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface TransportBookingRow {
  id: string;
  provider_id: string | null;
  listing_type: string; // service | rental
  item_id: string | null;
  item_title: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_city: string | null;
  notes: string | null;
  owner_email: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  start_date: string | null;
  end_date: string | null;
  passengers: number;
  total_price: number;
  status: string; // pending | accepted | rejected
  created_at: string;
}

export interface TransportBookingInput {
  provider_id: string | null;
  listing_type: "service" | "rental";
  item_id: string | null;
  item_title: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_city?: string | null;
  notes?: string | null;
  owner_email: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  start_date: string | null;
  end_date: string | null;
  passengers: number;
  total_price: number;
}

/** Human-friendly booking reference, e.g. SGB-A1B2C3D4 */
export function transportBookingRef(id: string) {
  return "SGB-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function createTransportBooking(input: TransportBookingInput) {
  return supabase.from("transport_bookings").insert(input).select().single();
}

export async function getTransportBookingsByOwner(
  email: string
): Promise<TransportBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("transport_bookings")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  return (data as TransportBookingRow[]) ?? [];
}

export async function getTransportBookingsByCustomer(
  email: string
): Promise<TransportBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("transport_bookings")
    .select("*")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  return (data as TransportBookingRow[]) ?? [];
}

export async function setTransportBookingStatus(
  id: string,
  status: "accepted" | "rejected"
) {
  return supabase.from("transport_bookings").update({ status }).eq("id", id);
}

/** Whether the user has a confirmed booking for an item — gates reviews. */
export async function hasAcceptedTransportBooking(
  email: string,
  itemId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !itemId) return false;
  const { data } = await supabase
    .from("transport_bookings")
    .select("id")
    .eq("customer_email", email)
    .eq("item_id", itemId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function getTransportBookingIdsForUser(
  email: string
): Promise<string[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("transport_bookings")
    .select("id")
    .or(`customer_email.eq.${email},owner_email.eq.${email}`);
  return (data as { id: string }[] | null)?.map((r) => r.id) ?? [];
}

/* ============================================================
 * Availability & inventory (prevent double booking)
 * ============================================================ */

export interface AvailabilityRow {
  id: string;
  item_id: string | null;
  item_type: string; // service | rental
  date: string;
  reason: string | null; // maintenance | private | unavailable
  owner_email: string | null;
  created_at: string;
}

/** Enumerate each calendar day (YYYY-MM-DD) from start to end inclusive. */
export function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date((end || start) + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return start ? [start] : [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Provider-blocked dates for an item. */
export async function getBlockedDates(itemId: string): Promise<AvailabilityRow[]> {
  if (!isSupabaseConfigured || !itemId) return [];
  const { data } = await supabase
    .from("transport_availability")
    .select("*")
    .eq("item_id", itemId)
    .order("date", { ascending: true });
  return (data as AvailabilityRow[]) ?? [];
}

export async function blockDates(opts: {
  itemId: string;
  itemType: "service" | "rental";
  dates: string[];
  reason: string;
  ownerEmail: string | null;
}) {
  if (!isSupabaseConfigured || !opts.dates.length) return { error: null };
  const rows = opts.dates.map((date) => ({
    item_id: opts.itemId,
    item_type: opts.itemType,
    date,
    reason: opts.reason,
    owner_email: opts.ownerEmail,
  }));
  return supabase.from("transport_availability").insert(rows);
}

export async function unblockDate(id: string) {
  return supabase.from("transport_availability").delete().eq("id", id);
}

/** Dates already taken by pending/accepted bookings for an item. */
export async function getBookedDates(itemId: string): Promise<string[]> {
  if (!isSupabaseConfigured || !itemId) return [];
  const { data } = await supabase
    .from("transport_bookings")
    .select("start_date,end_date,status")
    .eq("item_id", itemId)
    .in("status", ["pending", "accepted"]);
  const rows = (data as { start_date: string | null; end_date: string | null }[] | null) ?? [];
  const set = new Set<string>();
  for (const r of rows) {
    if (!r.start_date) continue;
    for (const d of enumerateDates(r.start_date, r.end_date || r.start_date)) set.add(d);
  }
  return Array.from(set);
}

/** All unavailable dates = booked + provider-blocked. */
export async function getUnavailableDates(itemId: string): Promise<string[]> {
  const [booked, blocked] = await Promise.all([
    getBookedDates(itemId),
    getBlockedDates(itemId),
  ]);
  const set = new Set<string>(booked);
  for (const b of blocked) set.add(b.date);
  return Array.from(set);
}

/**
 * True when none of the requested dates collide with an existing booking or a
 * provider block. Used to enforce: "Sorry, this vehicle is not available for
 * the selected dates."
 */
export async function isRangeAvailable(
  itemId: string,
  start: string,
  end: string
): Promise<boolean> {
  if (!start) return false;
  const requested = enumerateDates(start, end || start);
  const taken = new Set(await getUnavailableDates(itemId));
  return requested.every((d) => !taken.has(d));
}
