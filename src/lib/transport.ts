import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";
import { type Listing } from "@/lib/data";
import { updateOrQueue } from "@/lib/pending-edits";

/* ============================================================
 * Row types (match supabase/phase18-transport.sql)
 * ============================================================ */

export interface TransportProviderRow {
  id: string;
  name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  business_type: string | null; // Individual | Company | Tour Company
  reg_number: string | null;
  license_number: string | null;
  logo: string | null;
  cover_image: string | null;
  address: string | null;
  service_areas: string[] | null;
  description: string | null;
  opening_hours: string | null;
  emergency_contact: string | null;
  location: string | null;
  license_doc: string | null;
  owner_cnic: string | null;
  owner_cnic_doc: string | null;
  ownership_doc: string | null;
  rating: number;
  reviews: number;
  status: string;
  verified: boolean;
  featured: boolean;
  owner_email: string | null;
  created_at: string;
}

export interface TransportServiceRow {
  id: string;
  provider_id: string | null;
  provider_name: string | null;
  listing_type: string; // service
  title: string;
  vehicle_type: string | null; // Jeep|Car|Van|Coaster|Bus|Bike
  vehicle_name: string | null;
  model_year: string | null;
  vehicle_number: string | null;
  seats: number | null;
  driver_included: boolean;
  driver_name: string | null;
  driver_contact: string | null;
  route: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  price_per_trip: number | null;
  price_per_day: number;
  price_per_km: number | null;
  waiting_charges: number | null;
  ac: boolean;
  fuel_type: string | null;
  luggage: string | null;
  available_dates: string[] | null;
  blocked_dates: string[] | null;
  image: string | null;
  images: string[] | null;
  description: string | null;
  rules: string | null;
  location: string | null;
  rating: number;
  reviews: number;
  status: string;
  active: boolean;
  featured: boolean;
  owner_email: string | null;
  created_at: string;
}

export interface RentalVehicleRow {
  id: string;
  provider_id: string | null;
  provider_name: string | null;
  listing_type: string; // rental
  title: string;
  vehicle_type: string | null; // Car|Jeep|Bike|Van
  vehicle_name: string | null;
  model_year: string | null;
  vehicle_number: string | null;
  seats: number | null;
  rental_type: string | null; // Self Drive | With Driver Optional | Private Rental
  price_per_hour: number | null;
  price_per_day: number;
  weekly_price: number | null;
  monthly_price: number | null;
  security_deposit: number | null;
  required_documents: string[] | null;
  pickup_location: string | null;
  return_location: string | null;
  mileage_limit: string | null;
  extra_mileage_charges: number | null;
  fuel_policy: string | null;
  insurance_included: boolean;
  damage_policy: string | null;
  available_dates: string[] | null;
  blocked_dates: string[] | null;
  image: string | null;
  images: string[] | null;
  description: string | null;
  terms: string | null;
  location: string | null;
  rating: number;
  reviews: number;
  status: string;
  active: boolean;
  featured: boolean;
  owner_email: string | null;
  created_at: string;
}

/* Public column allowlists — exclude verification docs / owner ID. */
const PROVIDER_PUBLIC =
  "id,name,owner_name,phone,whatsapp,business_type,logo,cover_image,address,service_areas,description,opening_hours,emergency_contact,location,rating,reviews,status,verified,featured,owner_email,created_at,accept_pay_at_property,require_advance_payment,advance_payment_percentage,accepted_payment_methods,payment_bank_name,payment_account_title,payment_account_number,payment_iban,payment_jazzcash,payment_easypaisa,payment_instructions";

/* ============================================================
 * Listing mappers (for customer cards). listingType tags the
 * card badge: "Transport Service" or "Vehicle Rental".
 * ============================================================ */

export function serviceToListing(s: TransportServiceRow): Listing {
  return {
    id: s.id,
    title: s.title,
    category: "transport",
    categoryLabel: "Transport Service",
    location: s.location || s.route || "Gilgit Baltistan",
    price: s.price_per_day || s.price_per_trip || 0,
    unit: s.price_per_day ? "day" : "trip",
    rating: Number(s.rating),
    reviews: s.reviews,
    image: s.image || "https://picsum.photos/seed/transport/900/600",
    provider: s.provider_name || undefined,
  };
}

export function rentalToListing(r: RentalVehicleRow): Listing {
  return {
    id: r.id,
    title: r.title,
    category: "transport",
    categoryLabel: "Vehicle Rental",
    location: r.location || r.pickup_location || "Gilgit Baltistan",
    price: r.price_per_day,
    unit: "day",
    rating: Number(r.rating),
    reviews: r.reviews,
    image: r.image || "https://picsum.photos/seed/rental/900/600",
    provider: r.provider_name || undefined,
  };
}

/* ============================================================
 * Provider
 * ============================================================ */

export async function getProviderByOwner(
  email: string
): Promise<TransportProviderRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("transport_providers")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as TransportProviderRow;
}

export async function getProviderRowById(
  id: string
): Promise<TransportProviderRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("transport_providers")
    .select(PROVIDER_PUBLIC)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as TransportProviderRow;
}

export async function getApprovedProviders(): Promise<TransportProviderRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("transport_providers")
    .select(PROVIDER_PUBLIC)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as unknown as TransportProviderRow[]) ?? [];
}

export async function getAllProviders(): Promise<TransportProviderRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("transport_providers")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as TransportProviderRow[]) ?? [];
}

export async function getPendingProviders(): Promise<TransportProviderRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("transport_providers")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as TransportProviderRow[]) ?? [];
}

export type TransportProviderInput = Partial<
  Omit<TransportProviderRow, "id" | "created_at">
> & { name: string; owner_email: string };

export async function createProvider(input: TransportProviderInput) {
  return supabase.from("transport_providers").insert(input).select().single();
}
export async function updateProvider(
  id: string,
  input: Partial<TransportProviderInput>
) {
  return updateOrQueue("transport_providers", id, input as Record<string, unknown>);
}
export async function setProviderStatus(id: string, status: string) {
  return supabase.from("transport_providers").update({ status }).eq("id", id);
}
export async function setProviderVerified(id: string, verified: boolean) {
  return supabase.from("transport_providers").update({ verified }).eq("id", id);
}
export async function setProviderFeatured(id: string, featured: boolean) {
  return supabase.from("transport_providers").update({ featured }).eq("id", id);
}

/* ============================================================
 * Transport services (with driver / route)
 * ============================================================ */

export async function getServicesByProvider(
  providerId: string
): Promise<TransportServiceRow[]> {
  if (!isSupabaseConfigured || !isUuid(providerId)) return [];
  const { data } = await supabase
    .from("transport_services")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  return (data as TransportServiceRow[]) ?? [];
}

export async function getApprovedServices(): Promise<TransportServiceRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("transport_services")
    .select("*")
    .eq("status", "approved")
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as TransportServiceRow[]) ?? [];
}

export async function getApprovedServicesByProvider(
  providerId: string
): Promise<TransportServiceRow[]> {
  if (!isSupabaseConfigured || !isUuid(providerId)) return [];
  const { data } = await supabase
    .from("transport_services")
    .select("*")
    .eq("provider_id", providerId)
    .eq("status", "approved")
    .eq("active", true);
  return (data as TransportServiceRow[]) ?? [];
}

export async function getServiceById(
  id: string
): Promise<TransportServiceRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("transport_services")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as TransportServiceRow;
}

export async function getPendingServices(): Promise<TransportServiceRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("transport_services")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as TransportServiceRow[]) ?? [];
}

export type TransportServiceInput = Partial<
  Omit<TransportServiceRow, "id" | "created_at">
> & { title: string };
export async function createService(input: TransportServiceInput) {
  return supabase.from("transport_services").insert(input).select().single();
}
export async function updateService(
  id: string,
  input: Partial<TransportServiceInput>
) {
  return updateOrQueue("transport_services", id, input as Record<string, unknown>);
}
export async function deleteService(id: string) {
  return supabase.from("transport_services").delete().eq("id", id);
}
export async function setServiceStatus(id: string, status: string) {
  return supabase.from("transport_services").update({ status }).eq("id", id);
}

/* ============================================================
 * Rental vehicles (self-drive)
 * ============================================================ */

export async function getRentalsByProvider(
  providerId: string
): Promise<RentalVehicleRow[]> {
  if (!isSupabaseConfigured || !isUuid(providerId)) return [];
  const { data } = await supabase
    .from("rental_vehicles")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  return (data as RentalVehicleRow[]) ?? [];
}

export async function getApprovedRentals(): Promise<RentalVehicleRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("rental_vehicles")
    .select("*")
    .eq("status", "approved")
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as RentalVehicleRow[]) ?? [];
}

export async function getApprovedRentalsByProvider(
  providerId: string
): Promise<RentalVehicleRow[]> {
  if (!isSupabaseConfigured || !isUuid(providerId)) return [];
  const { data } = await supabase
    .from("rental_vehicles")
    .select("*")
    .eq("provider_id", providerId)
    .eq("status", "approved")
    .eq("active", true);
  return (data as RentalVehicleRow[]) ?? [];
}

export async function getRentalById(
  id: string
): Promise<RentalVehicleRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("rental_vehicles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as RentalVehicleRow;
}

export async function getPendingRentals(): Promise<RentalVehicleRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("rental_vehicles")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as RentalVehicleRow[]) ?? [];
}

export type RentalVehicleInput = Partial<
  Omit<RentalVehicleRow, "id" | "created_at">
> & { title: string };
export async function createRental(input: RentalVehicleInput) {
  return supabase.from("rental_vehicles").insert(input).select().single();
}
export async function updateRental(
  id: string,
  input: Partial<RentalVehicleInput>
) {
  return updateOrQueue("rental_vehicles", id, input as Record<string, unknown>);
}
export async function deleteRental(id: string) {
  return supabase.from("rental_vehicles").delete().eq("id", id);
}
export async function setRentalStatus(id: string, status: string) {
  return supabase.from("rental_vehicles").update({ status }).eq("id", id);
}
