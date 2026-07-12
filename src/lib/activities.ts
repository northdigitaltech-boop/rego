import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";

/* ============================================================
 * Activities & Adventures data layer
 * Matches supabase/phase39-activities.sql
 * ============================================================ */

// Outdoor activities (the original set).
export const ACTIVITY_CATEGORIES = [
  { slug: "camping", name: "Camping" },
  { slug: "trekking", name: "Trekking" },
  { slug: "hiking", name: "Hiking" },
  { slug: "jeep-safari", name: "Jeep Safari" },
  { slug: "horse-riding", name: "Horse Riding" },
  { slug: "fishing", name: "Fishing" },
  { slug: "boating", name: "Boating" },
  { slug: "cultural-tours", name: "Cultural Tours" },
] as const;

// Indoor Activities & Experiences (new sub-category of Activities).
export const INDOOR_ACTIVITY_CATEGORIES = [
  { slug: "indoor-photography-studio", name: "Indoor Photography Studio" },
  { slug: "snooker-club", name: "Snooker Club" },
  { slug: "gaming-zone", name: "Gaming Zone" },
  { slug: "swimming-pool", name: "Swimming Pool" },
  { slug: "art-handicraft-workshop", name: "Art & Handicraft Workshop" },
  { slug: "storytelling-safarnama", name: "Local Storytelling / Safarnama Session" },
] as const;

export const ALL_ACTIVITY_CATEGORIES = [
  ...ACTIVITY_CATEGORIES,
  ...INDOOR_ACTIVITY_CATEGORIES,
];

export const ACTIVITY_SLUGS = ALL_ACTIVITY_CATEGORIES.map((c) => c.slug);
export const INDOOR_SLUGS = INDOOR_ACTIVITY_CATEGORIES.map((c) => c.slug);
export const DIFFICULTIES = ["easy", "moderate", "hard"] as const;
export const PRICE_UNITS = ["person", "group", "day", "hour", "session"] as const;
export const ACTIVITY_KINDS = ["outdoor", "indoor"] as const;

export function activityCategoryName(slug: string): string {
  return ALL_ACTIVITY_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}
export function isActivityCategory(slug: string): boolean {
  return ACTIVITY_SLUGS.includes(slug as (typeof ACTIVITY_SLUGS)[number]);
}
export function isIndoorActivity(slug: string): boolean {
  return INDOOR_SLUGS.includes(slug as (typeof INDOOR_SLUGS)[number]);
}

export interface ActivityRow {
  id: string;
  owner_email: string | null;
  owner_type: string;
  business_name: string | null;
  title: string;
  category: string;
  activity_kind: string;
  opening_hours: string | null;
  description: string | null;
  location: string | null;
  city: string | null;
  meeting_point: string | null;
  duration: string | null;
  difficulty: string | null;
  group_size_min: number | null;
  group_size_max: number | null;
  price: number;
  price_unit: string;
  age_limit: string | null;
  season: string | null;
  includes: string[] | null;
  excludes: string[] | null;
  languages: string[] | null;
  highlights: string[] | null;
  image: string | null;
  gallery: string[] | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  map_link: string | null;
  rating: number;
  reviews: number;
  verified: boolean;
  featured: boolean;
  ranking_badge: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityBookingRow {
  id: string;
  activity_id: string | null;
  activity_title: string | null;
  owner_email: string | null;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  date: string | null;
  people: number;
  notes: string | null;
  status: string;
  created_at: string;
}

const PUBLIC_COLS =
  "id,owner_email,owner_type,business_name,title,category,activity_kind,opening_hours,description,location,city,meeting_point,duration,difficulty,group_size_min,group_size_max,price,price_unit,age_limit,season,includes,excludes,languages,highlights,image,gallery,phone,whatsapp,email,map_link,rating,reviews,verified,featured,ranking_badge,status,created_at,updated_at";

/* ---------------- Reads ---------------- */

export async function getApprovedActivities(category?: string): Promise<ActivityRow[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase.from("activities").select(PUBLIC_COLS).eq("status", "approved");
  if (category && isActivityCategory(category)) q = q.eq("category", category);
  const { data } = await q
    .order("featured", { ascending: false })
    .order("rating", { ascending: false });
  return (data as unknown as ActivityRow[]) ?? [];
}

export async function getActivityById(id: string): Promise<ActivityRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data } = await supabase.from("activities").select(PUBLIC_COLS).eq("id", id).maybeSingle();
  return (data as unknown as ActivityRow) ?? null;
}

export async function getActivitiesByOwner(email: string): Promise<ActivityRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("activities")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  return (data as ActivityRow[]) ?? [];
}

export async function getAllActivities(): Promise<ActivityRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("activities").select("*").order("created_at", { ascending: false });
  return (data as ActivityRow[]) ?? [];
}

export async function getActivityCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const s of ACTIVITY_SLUGS) out[s] = 0;
  if (!isSupabaseConfigured) return out;
  const { data } = await supabase.from("activities").select("category").eq("status", "approved");
  for (const r of (data as { category: string }[]) ?? []) {
    if (out[r.category] != null) out[r.category] += 1;
  }
  return out;
}

/* ---------------- Writes ---------------- */

export type ActivityInput = Partial<Omit<ActivityRow, "id" | "created_at" | "updated_at">> & {
  title: string;
  category: string;
};

export async function createActivity(input: ActivityInput) {
  return supabase.from("activities").insert(input).select().single();
}
export async function updateActivity(id: string, input: Partial<ActivityInput>) {
  return supabase
    .from("activities")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function deleteActivity(id: string) {
  return supabase.from("activities").delete().eq("id", id);
}
export async function setActivityStatus(id: string, status: string) {
  return supabase
    .from("activities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function setActivityVerified(id: string, verified: boolean) {
  return supabase.from("activities").update({ verified }).eq("id", id);
}
export async function setActivityFeatured(id: string, featured: boolean) {
  return supabase.from("activities").update({ featured }).eq("id", id);
}

/* ---------------- Bookings ---------------- */

export type ActivityBookingInput = {
  activity_id: string | null;
  activity_title: string | null;
  owner_email: string | null;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  date: string | null;
  people: number;
  notes: string | null;
};

export async function createActivityBooking(input: ActivityBookingInput) {
  return supabase.from("activity_bookings").insert(input).select().single();
}
export async function getActivityBookingsByOwner(email: string): Promise<ActivityBookingRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("activity_bookings")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  return (data as ActivityBookingRow[]) ?? [];
}
export async function getAllActivityBookings(): Promise<ActivityBookingRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("activity_bookings")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as ActivityBookingRow[]) ?? [];
}
export async function setActivityBookingStatus(
  id: string,
  status: "accepted" | "rejected" | "completed"
) {
  return supabase.from("activity_bookings").update({ status }).eq("id", id);
}
export async function hasAcceptedActivityBooking(email: string, activityId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !activityId) return false;
  const { data } = await supabase
    .from("activity_bookings")
    .select("id")
    .eq("customer_email", email)
    .eq("activity_id", activityId)
    .in("status", ["accepted", "completed"])
    .limit(1)
    .maybeSingle();
  return !!data;
}
export function activityBookingRef(id: string) {
  return "ACT-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
