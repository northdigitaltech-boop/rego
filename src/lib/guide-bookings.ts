import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface GuideBookingRow {
  id: string;
  guide_id: string | null;
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
  pickup_location: string | null;
  start_date: string | null;
  end_date: string | null;
  duration: string | null;
  guests: number;
  total_price: number;
  status: string;
  created_at: string;
}

export interface GuideBookingInput {
  guide_id: string | null;
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
  pickup_location?: string | null;
  start_date: string | null;
  end_date: string | null;
  duration?: string | null;
  guests: number;
  total_price: number;
}

/** Human-friendly booking reference, e.g. SGB-A1B2C3D4 */
export function guideBookingRef(id: string) {
  return "SGB-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function createGuideBooking(input: GuideBookingInput) {
  return supabase.from("guide_bookings").insert(input).select().single();
}

export async function getGuideBookingsByOwner(
  email: string
): Promise<GuideBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("guide_bookings")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  return (data as GuideBookingRow[]) ?? [];
}

export async function getGuideBookingsByCustomer(
  email: string
): Promise<GuideBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("guide_bookings")
    .select("*")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  return (data as GuideBookingRow[]) ?? [];
}

export async function setGuideBookingStatus(
  id: string,
  status: "accepted" | "rejected"
) {
  return supabase.from("guide_bookings").update({ status }).eq("id", id);
}

/** Whether the user has a confirmed booking for an independent guide. */
export async function hasAcceptedGuideBooking(
  email: string,
  guideId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !guideId) return false;
  const { data } = await supabase
    .from("guide_bookings")
    .select("id")
    .eq("customer_email", email)
    .eq("guide_id", guideId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function getGuideBookingIdsForUser(
  email: string
): Promise<string[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("guide_bookings")
    .select("id")
    .or(`customer_email.eq.${email},owner_email.eq.${email}`);
  return (data as { id: string }[] | null)?.map((r) => r.id) ?? [];
}

/* ============================================================
 * Availability (blocked dates) — guide_availability
 * ============================================================ */

export interface GuideAvailabilityRow {
  id: string;
  guide_id: string | null;
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

export async function getGuideBlockedDates(
  guideId: string
): Promise<GuideAvailabilityRow[]> {
  if (!isSupabaseConfigured || !guideId) return [];
  const { data } = await supabase
    .from("guide_availability")
    .select("*")
    .eq("guide_id", guideId)
    .order("date", { ascending: true });
  return (data as GuideAvailabilityRow[]) ?? [];
}

export async function blockGuideDates(opts: {
  guideId: string;
  dates: string[];
  reason: string;
  ownerEmail: string | null;
}) {
  if (!isSupabaseConfigured || !opts.dates.length) return { error: null };
  const rows = opts.dates.map((date) => ({
    guide_id: opts.guideId,
    date,
    reason: opts.reason,
    owner_email: opts.ownerEmail,
  }));
  return supabase.from("guide_availability").insert(rows);
}

export async function unblockGuideDate(id: string) {
  return supabase.from("guide_availability").delete().eq("id", id);
}

/** Dates taken by pending/accepted independent bookings. */
export async function getGuideBookedDates(guideId: string): Promise<string[]> {
  if (!isSupabaseConfigured || !guideId) return [];
  const { data } = await supabase
    .from("guide_bookings")
    .select("start_date,end_date,status")
    .eq("guide_id", guideId)
    .in("status", ["pending", "accepted"]);
  const rows =
    (data as { start_date: string | null; end_date: string | null }[] | null) ?? [];
  const set = new Set<string>();
  for (const r of rows) {
    if (!r.start_date) continue;
    for (const d of enumerateDates(r.start_date, r.end_date || r.start_date)) set.add(d);
  }
  return Array.from(set);
}

export async function getGuideUnavailableDates(guideId: string): Promise<string[]> {
  const [booked, blocked] = await Promise.all([
    getGuideBookedDates(guideId),
    getGuideBlockedDates(guideId),
  ]);
  const set = new Set<string>(booked);
  for (const b of blocked) set.add(b.date);
  return Array.from(set);
}

export async function isGuideRangeAvailable(
  guideId: string,
  start: string,
  end: string
): Promise<boolean> {
  if (!start) return false;
  const requested = enumerateDates(start, end || start);
  const taken = new Set(await getGuideUnavailableDates(guideId));
  return requested.every((d) => !taken.has(d));
}
