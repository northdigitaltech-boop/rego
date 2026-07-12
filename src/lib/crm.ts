import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Owner CRM & Analytics data layer (owner-scoped by owner_email)
 * Matches supabase/phase38-owner-crm.sql
 * ============================================================ */

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "interested",
  "follow-up",
  "confirmed",
  "lost",
] as const;

export const LEAD_SOURCES = [
  "whatsapp",
  "phone",
  "facebook",
  "instagram",
  "tiktok",
  "referral",
  "walk-in",
  "direct",
  "other",
] as const;

export const PIPELINE_STAGES = [
  "new-request",
  "contacted",
  "confirmed",
  "payment-pending",
  "booked",
  "completed",
  "review-requested",
  "cancelled",
] as const;

export function pipelineLabel(s: string): string {
  return (
    {
      "new-request": "New Request",
      contacted: "Contacted",
      confirmed: "Confirmed",
      "payment-pending": "Payment Pending",
      booked: "Booked",
      completed: "Completed",
      "review-requested": "Review Requested",
      cancelled: "Cancelled",
    }[s] ?? s
  );
}

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const FOLLOWUP_STATUSES = ["pending", "completed", "rescheduled"] as const;

export const EVENT_TYPES = [
  "profile_view",
  "listing_view",
  "whatsapp_click",
  "phone_click",
  "message_click",
  "booking_request_click",
  "wishlist_save",
  "wishlist_remove",
  "map_click",
  "review_click",
  "share_click",
] as const;

export function eventLabel(t: string): string {
  return t
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Whatsapp", "WhatsApp");
}

/* ---------------- Types ---------------- */

export interface LeadRow {
  id: string;
  owner_email: string;
  listing_id: string | null;
  listing_type: string | null;
  interested_service: string | null;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  travel_date: string | null;
  guests: number | null;
  budget: number | null;
  lead_source: string | null;
  lead_status: string;
  pipeline_stage: string | null;
  amount: number | null;
  follow_up_datetime: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowupRow {
  id: string;
  owner_email: string;
  lead_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  phone: string | null;
  booking_id: string | null;
  listing_id: string | null;
  related_service: string | null;
  follow_up_date: string | null;
  follow_up_time: string | null;
  priority: string;
  note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface NoteRow {
  id: string;
  owner_email: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  note: string;
  created_at: string;
}

export interface AnalyticsEventRow {
  id: string;
  owner_email: string | null;
  listing_id: string | null;
  service_type: string | null;
  event_type: string;
  visitor_id: string | null;
  user_email: string | null;
  device_type: string | null;
  city: string | null;
  country: string | null;
  referrer: string | null;
  created_at: string;
}

/* ============================================================
 * Leads
 * ============================================================ */

export async function getLeads(ownerEmail: string): Promise<LeadRow[]> {
  if (!isSupabaseConfigured || !ownerEmail) return [];
  const { data } = await supabase
    .from("owner_leads")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("created_at", { ascending: false });
  return (data as LeadRow[]) ?? [];
}

export type LeadInput = Partial<Omit<LeadRow, "id" | "created_at" | "updated_at">> & {
  owner_email: string;
};

export async function createLead(input: LeadInput) {
  return supabase.from("owner_leads").insert(input).select().single();
}
export async function updateLead(id: string, input: Partial<LeadInput>) {
  return supabase
    .from("owner_leads")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function deleteLead(id: string) {
  return supabase.from("owner_leads").delete().eq("id", id);
}

/* ============================================================
 * Follow-ups
 * ============================================================ */

export async function getFollowups(ownerEmail: string): Promise<FollowupRow[]> {
  if (!isSupabaseConfigured || !ownerEmail) return [];
  const { data } = await supabase
    .from("owner_followups")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("follow_up_date", { ascending: true, nullsFirst: false });
  return (data as FollowupRow[]) ?? [];
}

export type FollowupInput = Partial<Omit<FollowupRow, "id" | "created_at" | "updated_at">> & {
  owner_email: string;
};

export async function createFollowup(input: FollowupInput) {
  return supabase.from("owner_followups").insert(input).select().single();
}
export async function updateFollowup(id: string, input: Partial<FollowupInput>) {
  return supabase
    .from("owner_followups")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function deleteFollowup(id: string) {
  return supabase.from("owner_followups").delete().eq("id", id);
}

/* ============================================================
 * Notes
 * ============================================================ */

export async function getNotes(
  ownerEmail: string,
  entityType?: string,
  entityId?: string
): Promise<NoteRow[]> {
  if (!isSupabaseConfigured || !ownerEmail) return [];
  let q = supabase.from("owner_notes").select("*").eq("owner_email", ownerEmail);
  if (entityType) q = q.eq("entity_type", entityType);
  if (entityId) q = q.eq("entity_id", entityId);
  const { data } = await q.order("created_at", { ascending: false });
  return (data as NoteRow[]) ?? [];
}

export async function addNote(input: {
  owner_email: string;
  entity_type: string;
  entity_id?: string | null;
  entity_label?: string | null;
  note: string;
}) {
  return supabase.from("owner_notes").insert(input).select().single();
}
export async function deleteNote(id: string) {
  return supabase.from("owner_notes").delete().eq("id", id);
}

/* ============================================================
 * Analytics events
 * ============================================================ */

export async function getOwnerEvents(
  ownerEmail: string,
  sinceISO?: string
): Promise<AnalyticsEventRow[]> {
  if (!isSupabaseConfigured || !ownerEmail) return [];
  let q = supabase
    .from("listing_analytics_events")
    .select("*")
    .eq("owner_email", ownerEmail);
  if (sinceISO) q = q.gte("created_at", sinceISO);
  const { data } = await q.order("created_at", { ascending: false }).limit(5000);
  return (data as AnalyticsEventRow[]) ?? [];
}

/* ---------------- Date range presets ---------------- */

export type DatePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "last-month"
  | "all"
  | "custom";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

export function presetRange(p: DatePreset): { start: Date | null; end: Date | null } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (p) {
    case "today":
      return { start: startOfDay(now), end: null };
    case "yesterday": {
      const s = startOfDay(now);
      s.setDate(s.getDate() - 1);
      const e = startOfDay(now);
      return { start: s, end: e };
    }
    case "7d": {
      const s = startOfDay(now);
      s.setDate(s.getDate() - 6);
      return { start: s, end: null };
    }
    case "30d": {
      const s = startOfDay(now);
      s.setDate(s.getDate() - 29);
      return { start: s, end: null };
    }
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
    case "last-month":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 1),
      };
    default:
      return { start: null, end: null };
  }
}

export function inRange(iso: string, start: Date | null, end: Date | null): boolean {
  const t = new Date(iso).getTime();
  if (start && t < start.getTime()) return false;
  if (end && t >= end.getTime()) return false;
  return true;
}

/* ---------------- Aggregation ---------------- */

export interface ListingStat {
  listingId: string;
  serviceType: string | null;
  views: number;
  saves: number;
  whatsapp: number;
  phone: number;
  message: number;
  booking: number;
}

export interface EventSummary {
  total: number;
  byType: Record<string, number>;
  views: number;
  uniqueVisitors: number;
  repeatVisitors: number;
  devices: Record<string, number>;
  perListing: Map<string, ListingStat>;
  perDay: { date: string; views: number }[];
}

export function summarize(events: AnalyticsEventRow[]): EventSummary {
  const byType: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const visitorViews = new Map<string, number>();
  const perListing = new Map<string, ListingStat>();
  const dayViews = new Map<string, number>();

  for (const e of events) {
    byType[e.event_type] = (byType[e.event_type] ?? 0) + 1;
    if (e.device_type) devices[e.device_type] = (devices[e.device_type] ?? 0) + 1;

    const isView = e.event_type === "listing_view" || e.event_type === "profile_view";
    if (isView && e.visitor_id) {
      visitorViews.set(e.visitor_id, (visitorViews.get(e.visitor_id) ?? 0) + 1);
      const day = e.created_at.slice(0, 10);
      dayViews.set(day, (dayViews.get(day) ?? 0) + 1);
    }

    if (e.listing_id) {
      const cur =
        perListing.get(e.listing_id) ??
        {
          listingId: e.listing_id,
          serviceType: e.service_type,
          views: 0,
          saves: 0,
          whatsapp: 0,
          phone: 0,
          message: 0,
          booking: 0,
        };
      if (isView) cur.views += 1;
      else if (e.event_type === "wishlist_save") cur.saves += 1;
      else if (e.event_type === "whatsapp_click") cur.whatsapp += 1;
      else if (e.event_type === "phone_click") cur.phone += 1;
      else if (e.event_type === "message_click") cur.message += 1;
      else if (e.event_type === "booking_request_click") cur.booking += 1;
      perListing.set(e.listing_id, cur);
    }
  }

  const views = (byType["listing_view"] ?? 0) + (byType["profile_view"] ?? 0);
  const uniqueVisitors = visitorViews.size;
  let repeatVisitors = 0;
  visitorViews.forEach((v) => {
    if (v > 1) repeatVisitors += 1;
  });

  const perDay = Array.from(dayViews.entries())
    .map(([date, v]) => ({ date, views: v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total: events.length,
    byType,
    views,
    uniqueVisitors,
    repeatVisitors,
    devices,
    perListing,
    perDay,
  };
}

export function pct(numer: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((numer / denom) * 1000) / 10;
}
