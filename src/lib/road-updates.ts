import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Road Updates & Alerts — data layer
 * Matches supabase/phase42-road-updates.sql
 * ============================================================ */

export const ROADS = [
  { key: "karakoram-highway", name: "Karakoram Highway" },
  { key: "gilgit-skardu", name: "Gilgit to Skardu Road" },
  { key: "babusar-top", name: "Babusar Top Road" },
  { key: "chilas-road", name: "Chilas Road" },
  { key: "hunza-road", name: "Hunza Road" },
  { key: "astore-road", name: "Astore Road" },
  { key: "deosai-road", name: "Deosai Road" },
  { key: "khunjerab-pass", name: "Khunjerab Pass" },
] as const;

export function roadName(key: string): string {
  return ROADS.find((r) => r.key === key)?.name ?? key;
}

export const ROAD_STATUSES = [
  { value: "open", label: "Open" },
  { value: "partial", label: "Partially Open" },
  { value: "clearance", label: "Under Clearance" },
  { value: "risky", label: "Risky" },
  { value: "blocked", label: "Blocked" },
] as const;

export function statusLabel(v: string): string {
  return ROAD_STATUSES.find((s) => s.value === v)?.label ?? v;
}

export const ROAD_REASONS = [
  "Landslide",
  "Snow",
  "Flood",
  "Accident",
  "Protest",
  "Construction",
] as const;

export const ALERT_LEVELS = ["low", "medium", "high", "critical"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const REPORTER_REGIONS = [
  "Chilas",
  "Gilgit",
  "Skardu",
  "Hunza",
  "Astore",
  "Nagar",
  "Ghizer",
  "Sost",
] as const;

export const SOURCE_TYPES = [
  { value: "official", label: "Official (NHA / Police / GB Govt)" },
  { value: "reporter", label: "Trusted local reporter" },
  { value: "community", label: "Community report" },
  { value: "media", label: "News / media" },
] as const;

/* ---------------- Types ---------------- */

export interface RoadUpdateRow {
  id: string;
  road_key: string;
  road_name: string;
  location: string | null;
  status: string;
  reason: string | null;
  description: string | null;
  safety_message: string | null;
  source_name: string | null;
  source_link: string | null;
  source_type: string | null;
  verified: boolean;
  alert_level: string;
  expected_opening_time: string | null;
  alternative_route: string | null;
  updated_at: string;
  created_at: string;
}

export interface RoadReportRow {
  id: string;
  road_key: string;
  road_name: string;
  location: string | null;
  reason: string | null;
  description: string | null;
  media: string[] | null;
  reporter_email: string;
  reporter_name: string | null;
  reporter_phone: string | null;
  trusted: boolean;
  status: string;
  created_at: string;
}

export interface RoadReporterRow {
  id: string;
  email: string;
  name: string | null;
  region: string | null;
  phone: string | null;
  approved: boolean;
  created_at: string;
}

export interface RoadAlertSubRow {
  id: string;
  road_key: string;
  user_email: string;
  created_at: string;
}

/* ---------------- Presentation helpers ---------------- */

export function statusTone(status: string): {
  text: string;
  bg: string;
  border: string;
  dot: string;
} {
  switch (status) {
    case "open":
      return { text: "text-green-700", bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500" };
    case "partial":
      return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" };
    case "clearance":
      return { text: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200", dot: "bg-sky-500" };
    case "risky":
      return { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" };
    case "blocked":
      return { text: "text-red-700", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" };
    default:
      return { text: "text-forest", bg: "bg-muted", border: "border-border", dot: "bg-forest-600" };
  }
}

export function alertTone(level: string): { text: string; bg: string; label: string } {
  switch (level) {
    case "critical":
      return { text: "text-red-700", bg: "bg-red-100", label: "Critical" };
    case "high":
      return { text: "text-orange-700", bg: "bg-orange-100", label: "High" };
    case "medium":
      return { text: "text-amber-700", bg: "bg-amber-100", label: "Medium" };
    default:
      return { text: "text-green-700", bg: "bg-green-100", label: "Low" };
  }
}

/** Banner sentence for a road update. */
export function bannerText(u: RoadUpdateRow): string {
  if (u.status === "open") {
    return `Good News: ${u.road_name} is now open for traffic. Drive carefully and follow local safety instructions.`;
  }
  if (u.status === "blocked") {
    return `Alert: ${u.road_name} is currently blocked${
      u.location ? ` near ${u.location}` : ""
    }${u.reason ? ` due to ${u.reason.toLowerCase()}` : ""}. Please avoid travel until further update.`;
  }
  if (u.status === "partial") {
    return `Notice: ${u.road_name} is partially open${u.location ? ` near ${u.location}` : ""}. Expect delays and drive with caution.`;
  }
  if (u.status === "clearance") {
    return `Update: ${u.road_name} is under clearance${u.location ? ` near ${u.location}` : ""}. Follow crew instructions.`;
  }
  if (u.status === "risky") {
    return `Caution: ${u.road_name} is risky${u.location ? ` near ${u.location}` : ""}. Travel only if necessary.`;
  }
  return `${u.road_name}: ${statusLabel(u.status)}.`;
}

export function defaultSafetyMessage(status: string): string {
  switch (status) {
    case "blocked":
      return "Do not attempt to cross. Wait for an official all-clear before travelling.";
    case "risky":
      return "Drive slowly, keep headlights on, and avoid night travel on this section.";
    case "partial":
      return "Single-file traffic likely — follow marshals and keep a safe distance.";
    case "clearance":
      return "Clearance crews are active. Expect stoppages and obey their signals.";
    default:
      return "Conditions can change quickly in the mountains — carry warm clothing and fuel.";
  }
}

/* ---------------- Road updates CRUD ---------------- */

const UPDATE_COLS =
  "id,road_key,road_name,location,status,reason,description,safety_message,source_name,source_link,source_type,verified,alert_level,expected_opening_time,alternative_route,updated_at,created_at";

/** Latest verified update per road (one card each), newest first per road. */
export async function getPublicRoadUpdates(): Promise<RoadUpdateRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("road_updates")
    .select(UPDATE_COLS)
    .eq("verified", true)
    .order("updated_at", { ascending: false });
  const rows = (data as unknown as RoadUpdateRow[]) ?? [];
  // Keep only the newest verified update per road.
  const seen = new Set<string>();
  const latest: RoadUpdateRow[] = [];
  for (const r of rows) {
    if (seen.has(r.road_key)) continue;
    seen.add(r.road_key);
    latest.push(r);
  }
  return latest;
}

export async function getAllRoadUpdates(): Promise<RoadUpdateRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("road_updates")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data as RoadUpdateRow[]) ?? [];
}

export type RoadUpdateInput = Partial<
  Omit<RoadUpdateRow, "id" | "created_at" | "updated_at">
> & { road_key: string; road_name: string };

export async function createRoadUpdate(input: RoadUpdateInput) {
  return supabase.from("road_updates").insert(input).select().single();
}
export async function updateRoadUpdate(id: string, input: Partial<RoadUpdateInput>) {
  return supabase
    .from("road_updates")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function deleteRoadUpdate(id: string) {
  return supabase.from("road_updates").delete().eq("id", id);
}

/* ---------------- Community reports ---------------- */

export type RoadReportInput = {
  road_key: string;
  road_name: string;
  location: string | null;
  reason: string | null;
  description: string | null;
  media: string[] | null;
  reporter_email: string;
  reporter_name: string | null;
  reporter_phone: string | null;
  trusted: boolean;
};

export async function createRoadReport(input: RoadReportInput) {
  return supabase.from("road_reports").insert(input).select().single();
}

export async function getAllRoadReports(): Promise<RoadReportRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("road_reports")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as RoadReportRow[]) ?? [];
}

export async function getMyRoadReports(email: string): Promise<RoadReportRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("road_reports")
    .select("*")
    .eq("reporter_email", email)
    .order("created_at", { ascending: false });
  return (data as RoadReportRow[]) ?? [];
}

export async function setRoadReportStatus(id: string, status: "verified" | "rejected" | "pending") {
  return supabase.from("road_reports").update({ status }).eq("id", id);
}
export async function deleteRoadReport(id: string) {
  return supabase.from("road_reports").delete().eq("id", id);
}

/* ---------------- Trusted reporters ---------------- */

export async function getRoadReporter(email: string): Promise<RoadReporterRow | null> {
  if (!isSupabaseConfigured || !email) return null;
  const { data } = await supabase
    .from("road_reporters")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  return (data as RoadReporterRow) ?? null;
}

export async function isTrustedReporter(email: string): Promise<boolean> {
  const r = await getRoadReporter(email);
  return !!r?.approved;
}

export async function applyAsReporter(input: {
  email: string;
  name: string | null;
  region: string | null;
  phone: string | null;
}) {
  return supabase
    .from("road_reporters")
    .upsert({ ...input, approved: false }, { onConflict: "email" })
    .select()
    .single();
}

export async function getAllReporters(): Promise<RoadReporterRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("road_reporters")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as RoadReporterRow[]) ?? [];
}

export async function setReporterApproved(id: string, approved: boolean) {
  return supabase.from("road_reporters").update({ approved }).eq("id", id);
}
export async function deleteReporter(id: string) {
  return supabase.from("road_reporters").delete().eq("id", id);
}

/* ---------------- Alert subscriptions ---------------- */

export async function subscribeToRoad(roadKey: string, email: string) {
  return supabase
    .from("road_alert_subs")
    .upsert({ road_key: roadKey, user_email: email }, { onConflict: "road_key,user_email" });
}
export async function unsubscribeFromRoad(roadKey: string, email: string) {
  return supabase
    .from("road_alert_subs")
    .delete()
    .eq("road_key", roadKey)
    .eq("user_email", email);
}
export async function getMySubs(email: string): Promise<string[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("road_alert_subs")
    .select("road_key")
    .eq("user_email", email);
  return ((data as { road_key: string }[]) ?? []).map((r) => r.road_key);
}
export async function getSubscribersForRoad(roadKey: string): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("road_alert_subs")
    .select("user_email")
    .eq("road_key", roadKey);
  return ((data as { user_email: string }[]) ?? []).map((r) => r.user_email);
}

/* ============================================================
 * "AI" verification heuristic
 * Groups pending reports by road + normalised location; if 3+ *trusted*
 * reports cluster on the same spot, it's flagged High Priority for admin.
 * ============================================================ */

export interface ReportCluster {
  road_key: string;
  road_name: string;
  location: string;
  total: number;
  trusted: number;
  highPriority: boolean;
  reportIds: string[];
}

function normLoc(s: string | null): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function clusterReports(reports: RoadReportRow[]): ReportCluster[] {
  const pending = reports.filter((r) => r.status === "pending");
  const map = new Map<string, ReportCluster>();
  for (const r of pending) {
    const loc = normLoc(r.location);
    const key = `${r.road_key}::${loc}`;
    const c =
      map.get(key) ??
      ({
        road_key: r.road_key,
        road_name: r.road_name,
        location: r.location ?? "Unspecified",
        total: 0,
        trusted: 0,
        highPriority: false,
        reportIds: [],
      } as ReportCluster);
    c.total += 1;
    if (r.trusted) c.trusted += 1;
    c.reportIds.push(r.id);
    map.set(key, c);
  }
  const clusters = Array.from(map.values());
  for (const c of clusters) {
    // 3+ trusted reports on one spot → high priority (falls back to 3+ total).
    c.highPriority = c.trusted >= 3 || c.total >= 3;
  }
  return clusters
    .filter((c) => c.total >= 2)
    .sort((a, b) => Number(b.highPriority) - Number(a.highPriority) || b.total - a.total);
}
