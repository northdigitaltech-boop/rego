import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";

/* ============================================================
 * Events & Expo — admin-managed catalogue
 * Matches supabase/phase36-events.sql
 * ============================================================ */

export const EVENT_CATEGORIES = [
  { slug: "festivals", name: "Festivals" },
  { slug: "tourism-events", name: "Tourism Events" },
  { slug: "local-expos", name: "Local Expos" },
  { slug: "adventure-events", name: "Adventure Events" },
  { slug: "cultural-events", name: "Cultural Events" },
] as const;

export const EVENT_SLUGS = EVENT_CATEGORIES.map((c) => c.slug);

export function eventCategoryName(slug: string): string {
  return EVENT_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}
export function isEventCategory(slug: string): boolean {
  return EVENT_SLUGS.includes(slug as (typeof EVENT_SLUGS)[number]);
}

export interface EventRow {
  id: string;
  title: string;
  category: string;
  description: string | null;
  city: string | null;
  venue: string | null;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  time: string | null;
  image: string | null;
  gallery: string[] | null;
  organizer: string | null;
  ticket_price: number;
  ticket_info: string | null;
  registration_url: string | null;
  highlights: string[] | null;
  featured: boolean;
  status: string; // published | draft
  created_at: string;
  updated_at: string;
}

const PUBLIC_COLS =
  "id,title,category,description,city,venue,address,start_date,end_date,time,image,gallery,organizer,ticket_price,ticket_info,registration_url,highlights,featured,status,created_at,updated_at";

/* ---------------- Customer reads (published only) ---------------- */

export async function getPublishedEvents(category?: string): Promise<EventRow[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase
    .from("events")
    .select(PUBLIC_COLS)
    .eq("status", "published");
  if (category && isEventCategory(category)) q = q.eq("category", category);
  const { data } = await q
    .order("featured", { ascending: false })
    .order("start_date", { ascending: true });
  return (data as unknown as EventRow[]) ?? [];
}

export async function getEventById(id: string): Promise<EventRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data } = await supabase
    .from("events")
    .select(PUBLIC_COLS)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as EventRow) ?? null;
}

/** Count of published events per category (for the landing chips/cards). */
export async function getEventCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const s of EVENT_SLUGS) out[s] = 0;
  if (!isSupabaseConfigured) return out;
  const { data } = await supabase
    .from("events")
    .select("category")
    .eq("status", "published");
  for (const r of (data as { category: string }[]) ?? []) {
    if (out[r.category] != null) out[r.category] += 1;
  }
  return out;
}

/* ---------------- Admin ---------------- */

export async function getAllEvents(): Promise<EventRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("events")
    .select("*")
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data as EventRow[]) ?? [];
}

export type EventInput = Partial<Omit<EventRow, "id" | "created_at" | "updated_at">> & {
  title: string;
  category: string;
};

export async function createEvent(input: EventInput) {
  return supabase.from("events").insert(input).select().single();
}

export async function updateEvent(id: string, input: Partial<EventInput>) {
  return supabase
    .from("events")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deleteEvent(id: string) {
  return supabase.from("events").delete().eq("id", id);
}

export async function setEventStatus(id: string, status: string) {
  return supabase
    .from("events")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function setEventFeatured(id: string, featured: boolean) {
  return supabase.from("events").update({ featured }).eq("id", id);
}
