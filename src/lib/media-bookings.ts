import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface MediaBookingRow {
  id: string;
  provider_id: string | null;
  company_id: string | null;
  service_id: string | null;
  service_title: string | null;
  item_title: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_city: string | null;
  notes: string | null;
  owner_email: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  duration: string | null;
  people: number;
  shoot_type: string | null;
  drone_required: boolean;
  editing_required: boolean;
  total_price: number;
  delivery_link: string | null;
  status: string; // pending | accepted | rejected | completed
  created_at: string;
}

export interface MediaBookingInput {
  provider_id: string | null;
  company_id: string | null;
  service_id: string | null;
  service_title: string | null;
  item_title: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_city?: string | null;
  notes?: string | null;
  owner_email: string | null;
  location?: string | null;
  start_date: string | null;
  end_date: string | null;
  duration?: string | null;
  people: number;
  shoot_type?: string | null;
  drone_required?: boolean;
  editing_required?: boolean;
  total_price: number;
}

export function mediaBookingRef(id: string) {
  return "SGB-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function createMediaBooking(input: MediaBookingInput) {
  return supabase.from("media_bookings").insert(input).select().single();
}

export async function getMediaBookingsByOwner(
  email: string
): Promise<MediaBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("media_bookings")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  return (data as MediaBookingRow[]) ?? [];
}

export async function getMediaBookingsByCustomer(
  email: string
): Promise<MediaBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("media_bookings")
    .select("*")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  return (data as MediaBookingRow[]) ?? [];
}

export async function setMediaBookingStatus(
  id: string,
  status: "accepted" | "rejected" | "completed"
) {
  return supabase.from("media_bookings").update({ status }).eq("id", id);
}

export async function setMediaDeliveryLink(id: string, delivery_link: string) {
  return supabase.from("media_bookings").update({ delivery_link }).eq("id", id);
}

/** Whether the user has a confirmed/completed booking — gates reviews. */
export async function hasAcceptedMediaBooking(
  email: string,
  providerId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !providerId) return false;
  const { data } = await supabase
    .from("media_bookings")
    .select("id")
    .eq("customer_email", email)
    .eq("provider_id", providerId)
    .in("status", ["accepted", "completed"])
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function getMediaBookingIdsForUser(
  email: string
): Promise<string[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("media_bookings")
    .select("id")
    .or(`customer_email.eq.${email},owner_email.eq.${email}`);
  return (data as { id: string }[] | null)?.map((r) => r.id) ?? [];
}

/* ============================================================
 * Availability (blocked dates) — media_availability
 * ============================================================ */

export interface MediaAvailabilityRow {
  id: string;
  provider_id: string | null;
  date: string;
  reason: string | null;
  owner_email: string | null;
  created_at: string;
}

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

export async function getMediaBlockedDates(
  providerId: string
): Promise<MediaAvailabilityRow[]> {
  if (!isSupabaseConfigured || !providerId) return [];
  const { data } = await supabase
    .from("media_availability")
    .select("*")
    .eq("provider_id", providerId)
    .order("date", { ascending: true });
  return (data as MediaAvailabilityRow[]) ?? [];
}

export async function blockMediaDates(opts: {
  providerId: string;
  dates: string[];
  reason: string;
  ownerEmail: string | null;
}) {
  if (!isSupabaseConfigured || !opts.dates.length) return { error: null };
  const rows = opts.dates.map((date) => ({
    provider_id: opts.providerId,
    date,
    reason: opts.reason,
    owner_email: opts.ownerEmail,
  }));
  return supabase.from("media_availability").insert(rows);
}

export async function unblockMediaDate(id: string) {
  return supabase.from("media_availability").delete().eq("id", id);
}

export async function getMediaBookedDates(providerId: string): Promise<string[]> {
  if (!isSupabaseConfigured || !providerId) return [];
  const { data } = await supabase
    .from("media_bookings")
    .select("start_date,end_date,status")
    .eq("provider_id", providerId)
    .in("status", ["pending", "accepted", "completed"]);
  const rows =
    (data as { start_date: string | null; end_date: string | null }[] | null) ?? [];
  const set = new Set<string>();
  for (const r of rows) {
    if (!r.start_date) continue;
    for (const d of enumerateDates(r.start_date, r.end_date || r.start_date)) set.add(d);
  }
  return Array.from(set);
}

export async function getMediaUnavailableDates(providerId: string): Promise<string[]> {
  const [booked, blocked] = await Promise.all([
    getMediaBookedDates(providerId),
    getMediaBlockedDates(providerId),
  ]);
  const set = new Set<string>(booked);
  for (const b of blocked) set.add(b.date);
  return Array.from(set);
}

export async function isMediaRangeAvailable(
  providerId: string,
  start: string,
  end: string
): Promise<boolean> {
  if (!start) return false;
  const requested = enumerateDates(start, end || start);
  const taken = new Set(await getMediaUnavailableDates(providerId));
  return requested.every((d) => !taken.has(d));
}
