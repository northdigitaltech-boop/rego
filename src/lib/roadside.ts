import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";

/* ============================================================
 * Roadside Assistance data layer
 * Matches supabase/phase32-roadside.sql
 * ============================================================ */

export const ROADSIDE_SERVICES = [
  { slug: "bike-puncture", name: "Bike Puncture Service", short: "On-the-spot motorbike tyre repair" },
  { slug: "car-puncture", name: "Car Puncture Service", short: "Roadside car tyre repair & replacement" },
  { slug: "battery-service", name: "Battery Service", short: "Jump-starts and battery replacement" },
  { slug: "fuel-delivery", name: "Fuel Delivery", short: "Emergency petrol / diesel to your location" },
  { slug: "vehicle-recovery", name: "Vehicle Recovery", short: "Towing and 4x4 recovery on GB roads" },
] as const;

export const SERVICE_SLUGS = ROADSIDE_SERVICES.map((s) => s.slug);

export function serviceName(slug: string): string {
  return ROADSIDE_SERVICES.find((s) => s.slug === slug)?.name ?? slug;
}
export function isRoadsideService(slug: string): boolean {
  return SERVICE_SLUGS.includes(slug as (typeof SERVICE_SLUGS)[number]);
}

export const VEHICLE_TYPES = ["Bike", "Car", "Van", "Jeep", "Other"] as const;
export const URGENCY_LEVELS = ["normal", "urgent", "emergency"] as const;
export const CONTACT_METHODS = ["call", "whatsapp"] as const;
export const REQUEST_STATUSES = [
  "pending",
  "accepted",
  "on_the_way",
  "completed",
  "cancelled",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function requestStatusLabel(s: string): string {
  return (
    {
      pending: "Pending",
      accepted: "Accepted",
      on_the_way: "On the way",
      completed: "Completed",
      cancelled: "Cancelled",
    }[s] ?? s
  );
}

/* ---------------- Row types ---------------- */

export interface RoadsideProviderRow {
  id: string;
  owner_email: string | null;
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  service_areas: string[] | null;
  description: string | null;
  profile_image: string | null;
  cover_image: string | null;
  gallery_images: string[] | null;
  is_24_7: boolean;
  availability_status: string; // available | offline
  response_time: string | null;
  verification_doc: string | null;
  rating: number;
  total_reviews: number;
  verified: boolean;
  featured: boolean;
  ranking_badge: string | null;
  status: string; // pending | approved | rejected | suspended
  created_at: string;
  updated_at: string;
}

export interface RoadsideServiceRow {
  id: string;
  provider_id: string | null;
  service_type: string;
  starting_price: number;
  description: string | null;
  owner_email: string | null;
  created_at: string;
}

export interface RoadsideRequestRow {
  id: string;
  request_number: string | null;
  customer_email: string;
  provider_id: string | null;
  owner_email: string | null;
  service_type: string | null;
  provider_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_whatsapp: string | null;
  location_address: string | null;
  vehicle_type: string | null;
  problem_description: string | null;
  image_url: string | null;
  urgency: string;
  preferred_contact_method: string | null;
  status: string;
  provider_lat: number | null;
  provider_lng: number | null;
  provider_location_at: string | null;
  tracking_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoadsideReviewRow {
  id: string;
  provider_id: string | null;
  request_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  rating: number;
  review_text: string | null;
  owner_reply: string | null;
  owner_reply_at: string | null;
  created_at: string;
}

// Public column list (excludes verification_doc which is owner/admin only).
const PROVIDER_PUBLIC =
  "id,owner_email,business_name,owner_name,phone,whatsapp,email,address,city,service_areas,description,profile_image,cover_image,gallery_images,is_24_7,availability_status,response_time,rating,total_reviews,verified,featured,ranking_badge,status,created_at,updated_at";

/* ============================================================
 * Providers
 * ============================================================ */

export async function getRoadsideProviderByOwner(
  email: string
): Promise<RoadsideProviderRow | null> {
  if (!isSupabaseConfigured || !email) return null;
  const { data } = await supabase
    .from("roadside_providers")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RoadsideProviderRow) ?? null;
}

export async function getRoadsideProviderById(
  id: string
): Promise<RoadsideProviderRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data } = await supabase
    .from("roadside_providers")
    .select(PROVIDER_PUBLIC)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as RoadsideProviderRow) ?? null;
}

export async function getApprovedRoadsideProviders(): Promise<
  RoadsideProviderRow[]
> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("roadside_providers")
    .select(PROVIDER_PUBLIC)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("rating", { ascending: false });
  return (data as unknown as RoadsideProviderRow[]) ?? [];
}

/** Approved providers that offer a specific service, joined with their price. */
export async function getProvidersByService(service: string): Promise<
  { provider: RoadsideProviderRow; startingPrice: number }[]
> {
  if (!isSupabaseConfigured || !isRoadsideService(service)) return [];
  const { data: svcRows } = await supabase
    .from("roadside_provider_services")
    .select("provider_id,starting_price")
    .eq("service_type", service);
  const rows = (svcRows as { provider_id: string; starting_price: number }[]) ?? [];
  if (rows.length === 0) return [];
  const priceById = new Map(rows.map((r) => [r.provider_id, Number(r.starting_price)]));
  const ids = Array.from(priceById.keys());
  const { data: provs } = await supabase
    .from("roadside_providers")
    .select(PROVIDER_PUBLIC)
    .in("id", ids)
    .eq("status", "approved");
  const providers = (provs as unknown as RoadsideProviderRow[]) ?? [];
  return providers
    .map((p) => ({ provider: p, startingPrice: priceById.get(p.id) ?? 0 }))
    .sort(
      (a, b) =>
        Number(b.provider.featured) - Number(a.provider.featured) ||
        b.provider.rating - a.provider.rating
    );
}

/** Count of approved providers per service slug (for the service cards). */
export async function getServiceCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const s of SERVICE_SLUGS) out[s] = 0;
  if (!isSupabaseConfigured) return out;
  const approved = await getApprovedRoadsideProviders();
  const approvedIds = new Set(approved.map((p) => p.id));
  const { data } = await supabase
    .from("roadside_provider_services")
    .select("provider_id,service_type");
  const rows = (data as { provider_id: string; service_type: string }[]) ?? [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!approvedIds.has(r.provider_id)) continue;
    const key = r.service_type + "|" + r.provider_id;
    if (seen.has(key)) continue;
    seen.add(key);
    if (out[r.service_type] != null) out[r.service_type] += 1;
  }
  return out;
}

export async function getAllRoadsideProviders(): Promise<RoadsideProviderRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("roadside_providers")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as RoadsideProviderRow[]) ?? [];
}

export type RoadsideProviderInput = Partial<
  Omit<RoadsideProviderRow, "id" | "created_at" | "updated_at">
> & { business_name: string };

export async function createRoadsideProvider(input: RoadsideProviderInput) {
  return supabase.from("roadside_providers").insert(input).select().single();
}

export async function updateRoadsideProvider(
  id: string,
  input: Partial<RoadsideProviderInput>
) {
  return supabase
    .from("roadside_providers")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deleteRoadsideProvider(id: string) {
  return supabase.from("roadside_providers").delete().eq("id", id);
}

export async function setRoadsideProviderStatus(id: string, status: string) {
  return supabase
    .from("roadside_providers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function setRoadsideProviderVerified(id: string, verified: boolean) {
  return supabase.from("roadside_providers").update({ verified }).eq("id", id);
}
export async function setRoadsideProviderFeatured(id: string, featured: boolean) {
  return supabase.from("roadside_providers").update({ featured }).eq("id", id);
}
export async function setRoadsideAvailability(id: string, status: string) {
  return supabase
    .from("roadside_providers")
    .update({ availability_status: status, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/* ============================================================
 * Provider services (per-service prices)
 * ============================================================ */

export async function getAllProviderServices(): Promise<RoadsideServiceRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("roadside_provider_services").select("*");
  return (data as RoadsideServiceRow[]) ?? [];
}

export async function getServicesByProvider(
  providerId: string
): Promise<RoadsideServiceRow[]> {
  if (!isSupabaseConfigured || !isUuid(providerId)) return [];
  const { data } = await supabase
    .from("roadside_provider_services")
    .select("*")
    .eq("provider_id", providerId)
    .order("service_type", { ascending: true });
  return (data as RoadsideServiceRow[]) ?? [];
}

/** Replace a provider's service list in one shot (delete then insert). */
export async function replaceProviderServices(opts: {
  providerId: string;
  ownerEmail: string | null;
  services: { service_type: string; starting_price: number; description?: string | null }[];
}) {
  await supabase
    .from("roadside_provider_services")
    .delete()
    .eq("provider_id", opts.providerId);
  if (opts.services.length === 0) return { error: null };
  const rows = opts.services
    .filter((s) => isRoadsideService(s.service_type))
    .map((s) => ({
      provider_id: opts.providerId,
      service_type: s.service_type,
      starting_price: s.starting_price,
      description: s.description ?? null,
      owner_email: opts.ownerEmail,
    }));
  return supabase.from("roadside_provider_services").insert(rows);
}

/* ============================================================
 * Requests
 * ============================================================ */

export function newRequestNumber(): string {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(16).slice(2);
  return "RSA-" + rand.slice(0, 8).toUpperCase();
}

export type RoadsideRequestInput = {
  customer_email: string;
  provider_id: string | null;
  owner_email: string | null;
  service_type: string | null;
  provider_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_whatsapp?: string | null;
  location_address: string | null;
  vehicle_type: string | null;
  problem_description: string | null;
  image_url?: string | null;
  urgency: string;
  preferred_contact_method: string | null;
};

export async function createRoadsideRequest(input: RoadsideRequestInput) {
  const request_number = newRequestNumber();
  return supabase
    .from("roadside_requests")
    .insert({ ...input, request_number })
    .select()
    .single();
}

export async function getRequestsByOwner(
  email: string
): Promise<RoadsideRequestRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("roadside_requests")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  return (data as RoadsideRequestRow[]) ?? [];
}

export async function getRequestsByCustomer(
  email: string
): Promise<RoadsideRequestRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("roadside_requests")
    .select("*")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  return (data as RoadsideRequestRow[]) ?? [];
}

export async function getAllRoadsideRequests(): Promise<RoadsideRequestRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("roadside_requests")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as RoadsideRequestRow[]) ?? [];
}

export async function setRequestStatus(id: string, status: RequestStatus) {
  return supabase
    .from("roadside_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function getRoadsideRequestById(
  id: string
): Promise<RoadsideRequestRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data } = await supabase
    .from("roadside_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as RoadsideRequestRow) ?? null;
}

/** Provider persists their last-known position (throttled by the caller). */
export async function updateRequestLocation(
  id: string,
  lat: number,
  lng: number
) {
  return supabase
    .from("roadside_requests")
    .update({
      provider_lat: lat,
      provider_lng: lng,
      provider_location_at: new Date().toISOString(),
      tracking_active: true,
    })
    .eq("id", id);
}

export async function setTrackingActive(id: string, active: boolean) {
  return supabase.from("roadside_requests").update({ tracking_active: active }).eq("id", id);
}

/* ============================================================
 * Reviews
 * ============================================================ */

export async function getReviewsByProvider(
  providerId: string
): Promise<RoadsideReviewRow[]> {
  if (!isSupabaseConfigured || !isUuid(providerId)) return [];
  const { data } = await supabase
    .from("roadside_reviews")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  return (data as RoadsideReviewRow[]) ?? [];
}

export async function addRoadsideReview(input: {
  provider_id: string;
  request_id?: string | null;
  customer_email: string;
  customer_name: string | null;
  rating: number;
  review_text: string | null;
}) {
  return supabase.from("roadside_reviews").insert(input).select().single();
}

/** Provider posts / edits a public reply to a roadside review. */
export async function replyToRoadsideReview(id: string, reply: string) {
  return supabase
    .from("roadside_reviews")
    .update({
      owner_reply: reply.trim() || null,
      owner_reply_at: reply.trim() ? new Date().toISOString() : null,
    })
    .eq("id", id);
}

/** Whether a customer has a completed request with a provider — gates reviews. */
export async function hasCompletedRequest(
  email: string,
  providerId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !email || !providerId) return false;
  const { data } = await supabase
    .from("roadside_requests")
    .select("id")
    .eq("customer_email", email)
    .eq("provider_id", providerId)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();
  return !!data;
}
