import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Rego Map — data layer (Gilgit-Baltistan)
 * Matches supabase/phase45-rego-map.sql
 * ============================================================ */

/* ---------------- Categories (icon + color + emoji marker) ---------------- */
export interface MapCategory {
  slug: string;
  name: string;
  icon: string;   // lucide key (for filter chips)
  color: string;  // marker/theme color
  emoji: string;  // quick marker glyph
}

export const MAP_CATEGORIES: MapCategory[] = [
  { slug: "hotels", name: "Hotels", icon: "Hotel", color: "#1f5f45", emoji: "🏨" },
  { slug: "restaurants", name: "Restaurants", icon: "Utensils", color: "#b45309", emoji: "🍴" },
  { slug: "hospitals", name: "Hospitals", icon: "Plus", color: "#dc2626", emoji: "➕" },
  { slug: "rescue", name: "Rescue Points", icon: "LifeBuoy", color: "#e11d48", emoji: "⛑️" },
  { slug: "police", name: "Police Stations", icon: "ShieldAlert", color: "#1d4ed8", emoji: "🚓" },
  { slug: "checkpoints", name: "Checkpoints", icon: "ShieldCheck", color: "#334155", emoji: "🛡️" },
  { slug: "tourist-spots", name: "Tourist Spots", icon: "Mountain", color: "#0f766e", emoji: "🏔️" },
  { slug: "viewpoints", name: "Viewpoints", icon: "Binoculars", color: "#0891b2", emoji: "🔭" },
  { slug: "lakes", name: "Lakes", icon: "Waves", color: "#0284c7", emoji: "🌊" },
  { slug: "rivers", name: "Rivers", icon: "Waves", color: "#0ea5e9", emoji: "〰️" },
  { slug: "parks", name: "Parks", icon: "Trees", color: "#16a34a", emoji: "🌲" },
  { slug: "camping", name: "Camping Sites", icon: "Tent", color: "#15803d", emoji: "⛺" },
  { slug: "trekking", name: "Trekking Routes", icon: "Footprints", color: "#4d7c0f", emoji: "🥾" },
  { slug: "roads", name: "Roads", icon: "Route", color: "#6b7280", emoji: "🛣️" },
  { slug: "road-alerts", name: "Road Alerts", icon: "TriangleAlert", color: "#ea580c", emoji: "⚠️" },
  { slug: "petrol", name: "Petrol Pumps", icon: "Fuel", color: "#7c3aed", emoji: "⛽" },
  { slug: "airports", name: "Airports", icon: "Plane", color: "#0369a1", emoji: "✈️" },
  { slug: "bus", name: "Bus Stations", icon: "Bus", color: "#a16207", emoji: "🚌" },
  { slug: "banks", name: "Banks / ATM", icon: "Landmark", color: "#065f46", emoji: "🏧" },
  { slug: "mosques", name: "Mosques", icon: "Moon", color: "#047857", emoji: "🕌" },
  { slug: "forts", name: "Forts", icon: "Castle", color: "#92400e", emoji: "🏰" },
  { slug: "museums", name: "Museums", icon: "Building2", color: "#7c2d12", emoji: "🏛️" },
  { slug: "schools", name: "Schools", icon: "GraduationCap", color: "#4338ca", emoji: "🏫" },
  { slug: "info", name: "Tourist Info Centers", icon: "Info", color: "#0d9488", emoji: "ℹ️" },
];

export function mapCategory(slug: string): MapCategory | undefined {
  return MAP_CATEGORIES.find((c) => c.slug === slug);
}
export function categoryName(slug: string): string {
  return mapCategory(slug)?.name ?? slug;
}

/* ---------------- GB places (for distance calculator + centering) ---------------- */
export interface GbPlace {
  name: string;
  district: string;
  lat: number;
  lng: number;
}

export const GB_CENTER = { lat: 35.75, lng: 75.0, zoom: 7 };
export const GB_BOUNDS: [[number, number], [number, number]] = [
  [34.4, 72.5],
  [37.2, 77.2],
];

export const GB_PLACES: GbPlace[] = [
  { name: "Gilgit", district: "Gilgit", lat: 35.9208, lng: 74.308 },
  { name: "Skardu", district: "Skardu", lat: 35.2971, lng: 75.6333 },
  { name: "Hunza (Karimabad)", district: "Hunza", lat: 36.3167, lng: 74.6667 },
  { name: "Nagar", district: "Nagar", lat: 36.25, lng: 74.75 },
  { name: "Chilas", district: "Diamer", lat: 35.42, lng: 74.094 },
  { name: "Astore", district: "Astore", lat: 35.3667, lng: 74.8583 },
  { name: "Gahkuch (Ghizer)", district: "Ghizer", lat: 36.17, lng: 73.77 },
  { name: "Khaplu (Ghanche)", district: "Ghanche", lat: 35.1667, lng: 76.3167 },
  { name: "Shigar", district: "Shigar", lat: 35.4247, lng: 75.7333 },
  { name: "Kharmang", district: "Kharmang", lat: 35.1333, lng: 76.0 },
  { name: "Roundu", district: "Roundu", lat: 35.6667, lng: 75.0 },
  { name: "Deosai Plains", district: "Skardu", lat: 34.98, lng: 75.4 },
  { name: "Khunjerab Pass", district: "Hunza", lat: 36.85, lng: 75.42 },
  { name: "Babusar Top", district: "Diamer", lat: 35.12, lng: 74.05 },
  { name: "Attabad Lake", district: "Hunza", lat: 36.34, lng: 74.86 },
  { name: "Fairy Meadows", district: "Diamer", lat: 35.39, lng: 74.58 },
  { name: "Naltar Valley", district: "Gilgit", lat: 36.16, lng: 74.18 },
  { name: "Phander", district: "Ghizer", lat: 36.15, lng: 73.35 },
  { name: "Sost", district: "Hunza", lat: 36.6667, lng: 74.85 },
  { name: "Passu", district: "Hunza", lat: 36.4667, lng: 74.8833 },
];

/* ---------------- Default roads (shown even before DB rows exist) ---------------- */
export interface DefaultRoad {
  road_name: string;
  start_point: string;
  end_point: string;
  distance_km: number;
  estimated_time: string;
  road_type: string;
  difficulty: string;
  status: string;
  risk_level: string;
  path: [number, number][];
}

const P = Object.fromEntries(GB_PLACES.map((p) => [p.name, [p.lat, p.lng] as [number, number]]));

export const DEFAULT_ROADS: DefaultRoad[] = [
  { road_name: "Karakoram Highway (KKH)", start_point: "Chilas", end_point: "Khunjerab", distance_km: 340, estimated_time: "9–11 h", road_type: "highway", difficulty: "moderate", status: "open", risk_level: "medium",
    path: [P["Chilas"], P["Gilgit"], P["Hunza (Karimabad)"], P["Sost"], P["Khunjerab Pass"]] },
  { road_name: "Gilgit → Skardu Road", start_point: "Gilgit", end_point: "Skardu", distance_km: 210, estimated_time: "6–7 h", road_type: "highway", difficulty: "moderate", status: "open", risk_level: "medium",
    path: [P["Gilgit"], P["Roundu"], P["Skardu"]] },
  { road_name: "Gilgit → Hunza Road", start_point: "Gilgit", end_point: "Hunza (Karimabad)", distance_km: 100, estimated_time: "2.5–3 h", road_type: "highway", difficulty: "easy", status: "open", risk_level: "low",
    path: [P["Gilgit"], P["Nagar"], P["Hunza (Karimabad)"]] },
  { road_name: "Gilgit → Chilas Road", start_point: "Gilgit", end_point: "Chilas", distance_km: 130, estimated_time: "3.5–4 h", road_type: "highway", difficulty: "moderate", status: "open", risk_level: "medium",
    path: [P["Gilgit"], P["Chilas"]] },
  { road_name: "Skardu → Shigar Road", start_point: "Skardu", end_point: "Shigar", distance_km: 32, estimated_time: "1 h", road_type: "metalled", difficulty: "easy", status: "open", risk_level: "low",
    path: [P["Skardu"], P["Shigar"]] },
  { road_name: "Skardu → Khaplu Road", start_point: "Skardu", end_point: "Khaplu (Ghanche)", distance_km: 103, estimated_time: "2.5–3 h", road_type: "metalled", difficulty: "moderate", status: "open", risk_level: "low",
    path: [P["Skardu"], P["Kharmang"], P["Khaplu (Ghanche)"]] },
  { road_name: "Skardu → Deosai Road", start_point: "Skardu", end_point: "Deosai Plains", distance_km: 40, estimated_time: "2–3 h", road_type: "jeep-track", difficulty: "hard", status: "seasonal", risk_level: "high",
    path: [P["Skardu"], P["Deosai Plains"]] },
  { road_name: "Astore → Deosai Road", start_point: "Astore", end_point: "Deosai Plains", distance_km: 60, estimated_time: "3–4 h", road_type: "jeep-track", difficulty: "hard", status: "seasonal", risk_level: "high",
    path: [P["Astore"], P["Deosai Plains"]] },
  { road_name: "Babusar Top Road", start_point: "Chilas", end_point: "Babusar Top", distance_km: 75, estimated_time: "2.5–3 h", road_type: "metalled", difficulty: "moderate", status: "seasonal", risk_level: "high",
    path: [P["Chilas"], P["Babusar Top"]] },
  { road_name: "Khunjerab Pass Road", start_point: "Hunza (Karimabad)", end_point: "Khunjerab Pass", distance_km: 145, estimated_time: "4–5 h", road_type: "highway", difficulty: "moderate", status: "seasonal", risk_level: "medium",
    path: [P["Hunza (Karimabad)"], P["Sost"], P["Khunjerab Pass"]] },
];

/* ---------------- Types ---------------- */
export interface MapPlaceRow {
  id: string;
  name: string;
  category: string;
  district: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  description: string | null;
  photos: string[] | null;
  contact_number: string | null;
  status: string;
  is_verified: boolean;
  is_linked_service: boolean;
  linked_service_type: string | null;
  linked_service_id: string | null;
  linked_profile_url: string | null;
  source: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoadRouteRow {
  id: string;
  road_name: string;
  start_point: string | null;
  end_point: string | null;
  distance_km: number | null;
  estimated_time: string | null;
  road_type: string | null;
  difficulty: string | null;
  status: string;
  risk_level: string;
  path: [number, number][] | null;
  updated_at: string;
  created_at: string;
}

export interface RoadAlertRow {
  id: string;
  road_name: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  alert_type: string | null;
  status: string;
  reason: string | null;
  description: string | null;
  source_name: string | null;
  expected_opening_time: string | null;
  alert_level: string;
  is_danger_zone: boolean;
  created_at: string;
  updated_at: string;
}

export interface DistanceRow {
  id: string;
  from_location: string;
  to_location: string;
  distance_km: number | null;
  estimated_time: string | null;
  road_type: string | null;
  difficulty: string | null;
  notes: string | null;
  created_at: string;
}

export interface MapReportRow {
  id: string;
  user_email: string;
  user_name: string | null;
  report_type: string | null;
  location_name: string | null;
  road_name: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  photo: string | null;
  video: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

export const REPORT_TYPES = [
  "road-blocked", "road-open", "landslide", "snowfall", "accident", "traffic", "bridge", "rescue",
] as const;
export const ALERT_TYPES = [
  "landslide", "snowfall", "flood", "accident", "traffic", "construction", "bridge", "closed", "reopened",
] as const;
export const LINK_SERVICE_TYPES = [
  { type: "hotels", label: "Hotel", base: "/listings" },
  { type: "restaurants", label: "Restaurant", base: "/listings" },
  { type: "guides", label: "Tour Guide", base: "/listings" },
  { type: "transport", label: "Transport", base: "/listings" },
  { type: "photographers", label: "Photographer / Drone", base: "/listings" },
  { type: "activities", label: "Activity", base: "/activities" },
  { type: "roadside", label: "Roadside Assistance", base: "/roadside/provider" },
  { type: "coworking", label: "Co-working Space", base: "/coworking" },
] as const;

/** Build the profile URL for a linked service. */
export function linkedProfileUrl(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  const map: Record<string, string> = {
    hotels: `/listings/${id}`,
    restaurants: `/listings/${id}`,
    guides: `/listings/${id}`,
    transport: `/listings/${id}`,
    photographers: `/listings/${id}`,
    activities: `/activities/${id}`,
    roadside: `/roadside/provider/${id}`,
    coworking: `/coworking/${id}`,
  };
  return map[type] ?? null;
}

/* ---------------- Geo helpers ---------------- */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

/** GB mountain roads: apply a winding factor so straight-line km is realistic. */
export function roadKm(straightKm: number): number {
  return Math.round(straightKm * 1.6);
}

export function driveTime(km: number, roadType = "highway"): string {
  const speed = roadType === "jeep-track" ? 20 : roadType === "metalled" ? 35 : 45;
  const h = km / speed;
  if (h < 1) return `${Math.round(h * 60)} min`;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

export function fuelEstimate(km: number, kmPerLitre = 10, pricePerLitre = 290): { litres: number; cost: number } {
  const litres = Math.round((km / kmPerLitre) * 10) / 10;
  return { litres, cost: Math.round(litres * pricePerLitre) };
}

export function difficultyFor(roadType?: string | null): string {
  if (roadType === "jeep-track") return "Hard — 4x4 recommended";
  if (roadType === "metalled") return "Moderate";
  return "Easy–Moderate";
}

/* ---------------- Reads ---------------- */
export async function getPlaces(): Promise<MapPlaceRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("map_places")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });
  return (data as MapPlaceRow[]) ?? [];
}
export async function getAllPlaces(): Promise<MapPlaceRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("map_places").select("*").order("created_at", { ascending: false });
  return (data as MapPlaceRow[]) ?? [];
}
export async function getRoutes(): Promise<RoadRouteRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("road_routes").select("*").order("road_name");
  return (data as RoadRouteRow[]) ?? [];
}
export async function getAlerts(): Promise<RoadAlertRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("map_road_alerts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return (data as RoadAlertRow[]) ?? [];
}
export async function getAllAlerts(): Promise<RoadAlertRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("map_road_alerts").select("*").order("created_at", { ascending: false });
  return (data as RoadAlertRow[]) ?? [];
}
export async function getDistances(): Promise<DistanceRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("distance_chart").select("*").order("from_location");
  return (data as DistanceRow[]) ?? [];
}

/* ---------------- Writes: places ---------------- */
export type MapPlaceInput = Partial<Omit<MapPlaceRow, "id" | "created_at" | "updated_at">> & {
  name: string;
  category: string;
  latitude: number;
  longitude: number;
};
export async function createPlace(input: MapPlaceInput) {
  return supabase.from("map_places").insert(input).select().single();
}
export async function updatePlace(id: string, input: Partial<MapPlaceInput>) {
  return supabase.from("map_places").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id);
}
export async function deletePlace(id: string) {
  return supabase.from("map_places").delete().eq("id", id);
}
export async function setPlaceVerified(id: string, is_verified: boolean) {
  return supabase.from("map_places").update({ is_verified }).eq("id", id);
}

/* ---------------- Writes: routes ---------------- */
export type RoadRouteInput = Partial<Omit<RoadRouteRow, "id" | "created_at" | "updated_at">> & { road_name: string };
export async function createRoute(input: RoadRouteInput) {
  return supabase.from("road_routes").insert(input).select().single();
}
export async function updateRoute(id: string, input: Partial<RoadRouteInput>) {
  return supabase.from("road_routes").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id);
}
export async function deleteRoute(id: string) {
  return supabase.from("road_routes").delete().eq("id", id);
}

/* ---------------- Writes: alerts / danger zones ---------------- */
export type RoadAlertInput = Partial<Omit<RoadAlertRow, "id" | "created_at" | "updated_at">>;
export async function createAlert(input: RoadAlertInput) {
  return supabase.from("map_road_alerts").insert(input).select().single();
}
export async function updateAlert(id: string, input: Partial<RoadAlertInput>) {
  return supabase.from("map_road_alerts").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id);
}
export async function deleteAlert(id: string) {
  return supabase.from("map_road_alerts").delete().eq("id", id);
}

/* ---------------- Writes: distances ---------------- */
export type DistanceInput = Partial<Omit<DistanceRow, "id" | "created_at">> & { from_location: string; to_location: string };
export async function createDistance(input: DistanceInput) {
  return supabase.from("distance_chart").insert(input).select().single();
}
export async function deleteDistance(id: string) {
  return supabase.from("distance_chart").delete().eq("id", id);
}

/* ---------------- Community reports ---------------- */
export type MapReportInput = {
  user_email: string;
  user_name: string | null;
  report_type: string | null;
  location_name: string | null;
  road_name: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  photo: string | null;
  video: string | null;
};
export async function createReport(input: MapReportInput) {
  return supabase.from("map_reports").insert(input).select().single();
}
export async function getVerifiedReports(): Promise<MapReportRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("map_reports").select("*").eq("status", "verified").order("created_at", { ascending: false });
  return (data as MapReportRow[]) ?? [];
}
export async function getAllReports(): Promise<MapReportRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("map_reports").select("*").order("created_at", { ascending: false });
  return (data as MapReportRow[]) ?? [];
}
export async function setReportStatus(id: string, status: "verified" | "rejected" | "pending", admin_note?: string) {
  return supabase.from("map_reports").update({ status, admin_note: admin_note ?? null }).eq("id", id);
}
export async function deleteReport(id: string) {
  return supabase.from("map_reports").delete().eq("id", id);
}
