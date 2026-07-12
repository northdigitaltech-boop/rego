import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";

/* ============================================================
 * Connect Solo Traveler — data layer
 * Matches supabase/phase40-solo-travelers.sql
 * ============================================================ */

export const LOOKING_FOR = [
  "Travel Partner",
  "Photographer",
  "Backpacker",
  "Adventure Buddy",
  "Family Companion",
] as const;

export const TRAVEL_PREFERENCES = [
  "Adventure",
  "Hiking",
  "Camping",
  "Photography",
  "Road Trip",
  "Luxury Travel",
  "Backpacking",
  "Cultural Exploration",
  "Food Lover",
  "Nature",
  "Family Friendly",
] as const;

export const TRANSPORT_TYPES = [
  "Own Car",
  "Rented Jeep",
  "Public Transport",
  "Motorbike",
  "Shared Van",
  "Flight + Local",
] as const;

export const ACCOMMODATION_PREFS = [
  "Hotel",
  "Guest House",
  "Homestay",
  "Camping",
  "Hostel",
  "Budget",
  "Luxury",
] as const;

export const GB_DESTINATIONS = [
  "Skardu",
  "Hunza",
  "Gilgit",
  "Fairy Meadows",
  "Naltar Valley",
  "Khunjerab Pass",
  "Deosai Plains",
  "Shigar",
  "Ghizer",
  "Astore",
  "Rama Meadows",
  "Attabad Lake",
] as const;

export interface SoloPreviousTrip {
  destination: string;
  date: string;
  rating: number;
  story: string;
  photos: string[];
}

export interface SoloTravelerRow {
  id: string;
  owner_email: string | null;
  full_name: string;
  age: number | null;
  gender: string | null;
  nationality: string | null;
  current_city: string | null;
  profile_photo: string | null;
  cover_image: string | null;
  solo_badge: boolean;
  travel_score: number;
  last_active: string | null;
  intro: string | null;
  why_visiting: string | null;
  travel_experience: string | null;
  languages: string[] | null;
  occupation: string | null;
  interests: string[] | null;
  destinations: string[] | null;
  departure_date: string | null;
  return_date: string | null;
  duration: string | null;
  budget: string | null;
  transportation_type: string | null;
  accommodation_preference: string | null;
  available_seats: number | null;
  looking_for: string[] | null;
  gender_preference: string | null;
  age_preference: string | null;
  travel_preferences: string[] | null;
  gallery: string[] | null;
  videos: string[] | null;
  drone_shots: string[] | null;
  previous_trips: SoloPreviousTrip[] | null;
  id_verified: boolean;
  phone_verified: boolean;
  email_verified: boolean;
  face_verified: boolean;
  emergency_verified: boolean;
  emergency_contact_status: string | null;
  online: boolean;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  rating: number;
  reviews: number;
  verified: boolean;
  featured: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SoloConnectionRow {
  id: string;
  traveler_id: string | null;
  traveler_name: string | null;
  owner_email: string | null;
  requester_email: string;
  requester_name: string | null;
  requester_avatar: string | null;
  kind: string;
  seats: number;
  travel_date: string | null;
  pickup: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

const PUBLIC_COLS =
  "id,owner_email,full_name,age,gender,nationality,current_city,profile_photo,cover_image,solo_badge,travel_score,last_active,intro,why_visiting,travel_experience,languages,occupation,interests,destinations,departure_date,return_date,duration,budget,transportation_type,accommodation_preference,available_seats,looking_for,gender_preference,age_preference,travel_preferences,gallery,videos,drone_shots,previous_trips,id_verified,phone_verified,email_verified,face_verified,emergency_verified,emergency_contact_status,online,phone,whatsapp,email,rating,reviews,verified,featured,status,created_at,updated_at";

/* ---------------- Profiles ---------------- */

export async function getSoloByOwner(email: string): Promise<SoloTravelerRow | null> {
  if (!isSupabaseConfigured || !email) return null;
  const { data } = await supabase
    .from("solo_travelers")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SoloTravelerRow) ?? null;
}

export async function getSoloById(id: string): Promise<SoloTravelerRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data } = await supabase
    .from("solo_travelers")
    .select(PUBLIC_COLS)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as SoloTravelerRow) ?? null;
}

export async function getApprovedSolo(): Promise<SoloTravelerRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("solo_travelers")
    .select(PUBLIC_COLS)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("last_active", { ascending: false });
  return (data as unknown as SoloTravelerRow[]) ?? [];
}

export async function getAllSolo(): Promise<SoloTravelerRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("solo_travelers")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as SoloTravelerRow[]) ?? [];
}

export type SoloInput = Partial<
  Omit<SoloTravelerRow, "id" | "created_at" | "updated_at">
> & { full_name: string };

export async function createSolo(input: SoloInput) {
  return supabase.from("solo_travelers").insert(input).select().single();
}
export async function updateSolo(id: string, input: Partial<SoloInput>) {
  return supabase
    .from("solo_travelers")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function deleteSolo(id: string) {
  return supabase.from("solo_travelers").delete().eq("id", id);
}
export async function setSoloStatus(id: string, status: string) {
  return supabase
    .from("solo_travelers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function setSoloVerified(id: string, verified: boolean) {
  return supabase.from("solo_travelers").update({ verified }).eq("id", id);
}
export async function setSoloFeatured(id: string, featured: boolean) {
  return supabase.from("solo_travelers").update({ featured }).eq("id", id);
}
export async function touchSoloLastActive(id: string) {
  return supabase
    .from("solo_travelers")
    .update({ last_active: new Date().toISOString() })
    .eq("id", id);
}

/* ---------------- Trust score (display-only) ----------------
 * % based on how many of the 5 verification badges are set. */
export function computeTrustScore(t: {
  id_verified: boolean;
  phone_verified: boolean;
  email_verified: boolean;
  face_verified: boolean;
  emergency_verified: boolean;
}): number {
  const flags = [
    t.id_verified,
    t.phone_verified,
    t.email_verified,
    t.face_verified,
    t.emergency_verified,
  ];
  const yes = flags.filter(Boolean).length;
  return Math.round((yes / flags.length) * 100);
}

/** How many days until departure (null if no date / already departed). */
export function daysUntilDeparture(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return diff;
}

/** Rough compatibility score between a viewer's plan and a profile (0..100). */
export function compatibilityScore(
  viewer: SoloTravelerRow | null,
  target: SoloTravelerRow
): number {
  if (!viewer) return 0;
  let score = 0;
  let max = 0;
  const overlap = (a?: string[] | null, b?: string[] | null) => {
    const sa = new Set((a ?? []).map((x) => x.toLowerCase()));
    return (b ?? []).filter((x) => sa.has(x.toLowerCase())).length;
  };
  // destinations (40)
  max += 40;
  if (overlap(viewer.destinations, target.destinations) > 0) score += 40;
  // travel preferences (30)
  max += 30;
  const prefHits = overlap(viewer.travel_preferences, target.travel_preferences);
  score += Math.min(30, prefHits * 10);
  // languages (15)
  max += 15;
  if (overlap(viewer.languages, target.languages) > 0) score += 15;
  // date proximity (15)
  max += 15;
  const dv = daysUntilDeparture(viewer.departure_date);
  const dt = daysUntilDeparture(target.departure_date);
  if (dv != null && dt != null && Math.abs(dv - dt) <= 7) score += 15;
  return Math.round((score / max) * 100);
}

/* ---------------- Connections ---------------- */

export type SoloConnectionInput = {
  traveler_id: string | null;
  traveler_name: string | null;
  owner_email: string | null;
  requester_email: string;
  requester_name: string | null;
  requester_avatar: string | null;
  kind: string;
  seats: number;
  travel_date: string | null;
  pickup: string | null;
  message: string | null;
};

export async function createSoloConnection(input: SoloConnectionInput) {
  return supabase.from("solo_connections").insert(input).select().single();
}

export async function getSoloConnectionsByOwner(
  email: string
): Promise<SoloConnectionRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("solo_connections")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  return (data as SoloConnectionRow[]) ?? [];
}

export async function getSoloConnectionsByRequester(
  email: string
): Promise<SoloConnectionRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("solo_connections")
    .select("*")
    .eq("requester_email", email)
    .order("created_at", { ascending: false });
  return (data as SoloConnectionRow[]) ?? [];
}

export async function getAllSoloConnections(): Promise<SoloConnectionRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("solo_connections")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as SoloConnectionRow[]) ?? [];
}

export async function setSoloConnectionStatus(
  id: string,
  status: "accepted" | "rejected"
) {
  return supabase.from("solo_connections").update({ status }).eq("id", id);
}

/** Whether these two travellers have an accepted connection (gate reviews). */
export async function hasAcceptedConnectionWith(
  requesterEmail: string,
  ownerEmail: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !requesterEmail || !ownerEmail) return false;
  const { data } = await supabase
    .from("solo_connections")
    .select("id")
    .or(
      `and(requester_email.eq.${requesterEmail},owner_email.eq.${ownerEmail}),and(requester_email.eq.${ownerEmail},owner_email.eq.${requesterEmail})`
    )
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  return !!data;
}

export function soloConnectionRef(id: string) {
  return "SOLO-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export type SoloConnStatus = "none" | "pending" | "accepted" | "rejected";

/** Latest connection status between a viewer and a profile owner (either direction). */
export async function getSoloConnectionStatus(
  userEmail: string,
  ownerEmail: string
): Promise<SoloConnStatus> {
  if (!isSupabaseConfigured || !userEmail || !ownerEmail) return "none";
  const { data } = await supabase
    .from("solo_connections")
    .select("status,created_at")
    .or(
      `and(requester_email.eq.${userEmail},owner_email.eq.${ownerEmail}),and(requester_email.eq.${ownerEmail},owner_email.eq.${userEmail})`
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { status?: SoloConnStatus })?.status as SoloConnStatus) ?? "none";
}

/* ============================================================
 * Traveller ↔ traveller chat thread id
 * Reuses the shared `messages` table (booking_id is a plain UUID, no FK). The
 * thread id is a *deterministic* UUID derived from the two emails (sorted), so
 * both travellers always resolve to the same thread. Mirrors adminThreadId().
 * ============================================================ */

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/** Stable UUID for the chat thread between two travellers. */
export function soloThreadId(emailA: string, emailB: string): string {
  const pair = [emailA.trim().toLowerCase(), emailB.trim().toLowerCase()]
    .sort()
    .join("::");
  const [a, b, c, d] = cyrb128("rego-solo::" + pair);
  const hx = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  const h = hx(a) + hx(b) + hx(c) + hx(d);
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
