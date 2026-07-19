import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";
import { type Listing } from "@/lib/data";
import { updateOrQueue } from "@/lib/pending-edits";

/* ============================================================
 * Row types (match supabase/phase16-tour-companies.sql)
 * ============================================================ */

export interface TourCompanyRow {
  id: string;
  name: string;
  ranking_badge?: string | null;
  map_link?: string | null;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  reg_number: string | null;
  license_number: string | null;
  logo: string | null;
  cover_image: string | null;
  gallery: string[] | null;
  office_address: string | null;
  service_areas: string[] | null;
  destinations: string[] | null;
  description: string | null;
  experience_years: number | null;
  languages: string[] | null;
  emergency_contact: string | null;
  opening_hours: string | null;
  social_links: string[] | null;
  website: string | null;
  license_doc: string | null;
  owner_cnic: string | null;
  owner_cnic_doc: string | null;
  ownership_doc: string | null;
  terms: string | null;
  cancellation_policy: string | null;
  rating: number;
  reviews: number;
  location: string | null;
  status: string;
  verified: boolean;
  featured: boolean;
  owner_email: string | null;
  created_at: string;
}

export interface TourPackageRow {
  id: string;
  company_id: string | null;
  company_name: string | null;
  title: string;
  destination: string | null;
  location: string | null;
  duration: string | null;
  package_type: string | null;
  price_per_person: number;
  group_price: number | null;
  min_persons: number | null;
  max_persons: number | null;
  start_location: string | null;
  end_location: string | null;
  included: string[] | null;
  excluded: string[] | null;
  itinerary: string | null;
  accommodation_included: boolean;
  transport_included: boolean;
  guide_included: boolean;
  meals_included: boolean;
  image: string | null;
  images: string[] | null;
  available_dates: string[] | null;
  difficulty_level: string | null;
  cancellation_policy: string | null;
  terms: string | null;
  rating: number;
  reviews: number;
  status: string;
  active: boolean;
  owner_email: string | null;
  created_at: string;
}

export interface TransportRow {
  id: string;
  company_id: string | null;
  company_name: string | null;
  name: string;
  vehicle_type: string | null;
  model_year: string | null;
  vehicle_number: string | null;
  seats: number | null;
  driver_included: boolean;
  driver_name: string | null;
  driver_contact: string | null;
  price_per_day: number;
  price_per_trip: number | null;
  areas: string[] | null;
  location: string | null;
  image: string | null;
  images: string[] | null;
  ac: boolean;
  fuel_type: string | null;
  availability_status: string | null;
  rating: number;
  reviews: number;
  status: string;
  active: boolean;
  owner_email: string | null;
  created_at: string;
}

export interface TourGuideRow {
  id: string;
  company_id: string | null;
  company_name: string | null;
  name: string;
  image: string | null;
  phone: string | null;
  languages: string[] | null;
  experience_years: number | null;
  specialization: string | null;
  areas: string[] | null;
  location: string | null;
  price_per_day: number;
  availability_status: string | null;
  bio: string | null;
  certifications: string[] | null;
  rating: number;
  reviews: number;
  status: string;
  active: boolean;
  owner_email: string | null;
  created_at: string;
  // Phase 19 — independent guide + richer profile fields
  cnic?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  guide_type?: string | null;
  price_per_trip?: number | null;
  hourly_price?: number | null;
  skills?: string[] | null;
  gallery?: string[] | null;
  social_links?: string[] | null;
  emergency_contact?: string | null;
  min_hours?: number | null;
  max_days?: number | null;
  seasonal_availability?: string | null;
  cnic_doc?: string | null;
  license_doc?: string | null;
  verified?: boolean;
  featured?: boolean;
}

/* Public column allowlists — exclude verification docs / owner ID. */
const COMPANY_PUBLIC =
  "id,name,owner_name,logo,cover_image,gallery,office_address,service_areas,destinations,description,experience_years,languages,phone,whatsapp,emergency_contact,opening_hours,social_links,website,terms,cancellation_policy,rating,reviews,location,status,verified,featured,ranking_badge,owner_email,created_at,accept_pay_at_property,require_advance_payment,advance_payment_percentage,accepted_payment_methods,payment_bank_name,payment_account_title,payment_account_number,payment_iban,payment_jazzcash,payment_easypaisa,payment_instructions";

/* ============================================================
 * Listing mappers (for customer category cards)
 * ============================================================ */

export function packageToListing(p: TourPackageRow): Listing {
  return {
    id: p.id,
    title: p.title,
    category: "tours",
    categoryLabel: p.package_type ? `${p.package_type} Tour` : "Tour Package",
    location: p.destination || p.location || "Gilgit Baltistan",
    price: p.price_per_person,
    unit: "person",
    rating: Number(p.rating),
    reviews: p.reviews,
    image: p.image || "https://picsum.photos/seed/tour/900/600",
    provider: p.company_name || undefined,
  };
}

export function transportToListing(t: TransportRow): Listing {
  return {
    id: t.id,
    title: t.name,
    category: "transport",
    categoryLabel: t.vehicle_type || "Transport",
    location: t.location || "Gilgit Baltistan",
    price: t.price_per_day,
    unit: "day",
    rating: Number(t.rating),
    reviews: t.reviews,
    image: t.image || "https://picsum.photos/seed/transport/900/600",
    provider: t.company_name || undefined,
  };
}

export function guideToListing(g: TourGuideRow): Listing {
  const type = g.guide_type || g.specialization;
  return {
    id: g.id,
    title: g.name,
    category: "guides",
    categoryLabel: type ? `${type} Guide` : "Tour Guide",
    location: g.location || g.city || "Gilgit Baltistan",
    price: g.price_per_day,
    unit: "day",
    rating: Number(g.rating),
    reviews: g.reviews,
    image: g.image || "https://picsum.photos/seed/guide/900/600",
    provider: g.company_name || undefined,
  };
}

/* ============================================================
 * Tour company
 * ============================================================ */

export async function getCompanyByOwner(
  email: string
): Promise<TourCompanyRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("tour_companies")
    .select("*")
    .eq("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as TourCompanyRow;
}

export async function getCompanyRowById(
  id: string
): Promise<TourCompanyRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("tour_companies")
    .select(COMPANY_PUBLIC)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as TourCompanyRow;
}

export async function getApprovedCompanies(): Promise<TourCompanyRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("tour_companies")
    .select(COMPANY_PUBLIC)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as unknown as TourCompanyRow[]) ?? [];
}

export async function getAllCompanies(): Promise<TourCompanyRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("tour_companies")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as TourCompanyRow[]) ?? [];
}

export async function getPendingCompanies(): Promise<TourCompanyRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("tour_companies")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as TourCompanyRow[]) ?? [];
}

export type TourCompanyInput = Partial<Omit<TourCompanyRow, "id" | "created_at">> & {
  name: string;
  owner_email: string;
};

export async function createCompany(input: TourCompanyInput) {
  return supabase.from("tour_companies").insert(input).select().single();
}
export async function updateCompany(id: string, input: Partial<TourCompanyInput>) {
  return updateOrQueue("tour_companies", id, input as Record<string, unknown>);
}
export async function setCompanyStatus(id: string, status: string) {
  return supabase.from("tour_companies").update({ status }).eq("id", id);
}
export async function setCompanyVerified(id: string, verified: boolean) {
  return supabase.from("tour_companies").update({ verified }).eq("id", id);
}
export async function setCompanyFeatured(id: string, featured: boolean) {
  return supabase.from("tour_companies").update({ featured }).eq("id", id);
}

/* ============================================================
 * Tour packages
 * ============================================================ */

export async function getPackagesByCompany(
  companyId: string
): Promise<TourPackageRow[]> {
  if (!isSupabaseConfigured || !isUuid(companyId)) return [];
  const { data } = await supabase
    .from("tour_packages")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return (data as TourPackageRow[]) ?? [];
}

export async function getApprovedPackages(): Promise<TourPackageRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("tour_packages")
    .select("*")
    .eq("status", "approved")
    .eq("active", true)
    .order("created_at", { ascending: false });
  return (data as TourPackageRow[]) ?? [];
}

export async function getAllPackages(): Promise<TourPackageRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("tour_packages")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as TourPackageRow[]) ?? [];
}

export async function getApprovedPackagesByCompany(
  companyId: string
): Promise<TourPackageRow[]> {
  if (!isSupabaseConfigured || !isUuid(companyId)) return [];
  const { data } = await supabase
    .from("tour_packages")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "approved")
    .eq("active", true);
  return (data as TourPackageRow[]) ?? [];
}

export async function getPackageById(id: string): Promise<TourPackageRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("tour_packages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as TourPackageRow;
}

export async function getPendingPackages(): Promise<TourPackageRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("tour_packages")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as TourPackageRow[]) ?? [];
}

export type TourPackageInput = Partial<Omit<TourPackageRow, "id" | "created_at">> & {
  title: string;
};
export async function createPackage(input: TourPackageInput) {
  return supabase.from("tour_packages").insert(input).select().single();
}
export async function updatePackage(id: string, input: Partial<TourPackageInput>) {
  return updateOrQueue("tour_packages", id, input as Record<string, unknown>);
}
export async function deletePackage(id: string) {
  return supabase.from("tour_packages").delete().eq("id", id);
}
export async function setPackageStatus(id: string, status: string) {
  return supabase.from("tour_packages").update({ status }).eq("id", id);
}

/* ============================================================
 * Transports
 * ============================================================ */

export async function getTransportsByCompany(
  companyId: string
): Promise<TransportRow[]> {
  if (!isSupabaseConfigured || !isUuid(companyId)) return [];
  const { data } = await supabase
    .from("transports")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return (data as TransportRow[]) ?? [];
}

export async function getApprovedTransports(): Promise<TransportRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("transports")
    .select("*")
    .eq("status", "approved")
    .eq("active", true)
    .order("created_at", { ascending: false });
  return (data as TransportRow[]) ?? [];
}

export async function getApprovedTransportsByCompany(
  companyId: string
): Promise<TransportRow[]> {
  if (!isSupabaseConfigured || !isUuid(companyId)) return [];
  const { data } = await supabase
    .from("transports")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "approved")
    .eq("active", true);
  return (data as TransportRow[]) ?? [];
}

export async function getTransportById(id: string): Promise<TransportRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("transports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as TransportRow;
}

export async function getPendingTransports(): Promise<TransportRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("transports")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as TransportRow[]) ?? [];
}

export type TransportInput = Partial<Omit<TransportRow, "id" | "created_at">> & {
  name: string;
};
export async function createTransport(input: TransportInput) {
  return supabase.from("transports").insert(input).select().single();
}
export async function updateTransport(id: string, input: Partial<TransportInput>) {
  return updateOrQueue("transports", id, input as Record<string, unknown>);
}
export async function deleteTransport(id: string) {
  return supabase.from("transports").delete().eq("id", id);
}
export async function setTransportStatus(id: string, status: string) {
  return supabase.from("transports").update({ status }).eq("id", id);
}

/* ============================================================
 * Tour guides
 * ============================================================ */

export async function getGuidesByCompany(
  companyId: string
): Promise<TourGuideRow[]> {
  if (!isSupabaseConfigured || !isUuid(companyId)) return [];
  const { data } = await supabase
    .from("tour_guides")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return (data as TourGuideRow[]) ?? [];
}

export async function getApprovedGuides(): Promise<TourGuideRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("tour_guides")
    .select("*")
    .eq("status", "approved")
    .eq("active", true)
    .order("created_at", { ascending: false });
  return (data as TourGuideRow[]) ?? [];
}

export async function getApprovedGuidesByCompany(
  companyId: string
): Promise<TourGuideRow[]> {
  if (!isSupabaseConfigured || !isUuid(companyId)) return [];
  const { data } = await supabase
    .from("tour_guides")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "approved")
    .eq("active", true);
  return (data as TourGuideRow[]) ?? [];
}

export async function getGuideById(id: string): Promise<TourGuideRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("tour_guides")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as TourGuideRow;
}

export async function getAllGuides(): Promise<TourGuideRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("tour_guides")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as TourGuideRow[]) ?? [];
}

export async function getPendingGuides(): Promise<TourGuideRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("tour_guides")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as TourGuideRow[]) ?? [];
}

export type TourGuideInput = Partial<Omit<TourGuideRow, "id" | "created_at">> & {
  name: string;
};
export async function createGuide(input: TourGuideInput) {
  return supabase.from("tour_guides").insert(input).select().single();
}
export async function updateGuide(id: string, input: Partial<TourGuideInput>) {
  return updateOrQueue("tour_guides", id, input as Record<string, unknown>);
}
export async function deleteGuide(id: string) {
  return supabase.from("tour_guides").delete().eq("id", id);
}
export async function setGuideStatus(id: string, status: string) {
  return supabase.from("tour_guides").update({ status }).eq("id", id);
}
export async function setGuideVerified(id: string, verified: boolean) {
  return supabase.from("tour_guides").update({ verified }).eq("id", id);
}
export async function setGuideFeatured(id: string, featured: boolean) {
  return supabase.from("tour_guides").update({ featured }).eq("id", id);
}

/** The independent guide profile owned by this email (company_id null). */
export async function getGuideByOwner(
  email: string
): Promise<TourGuideRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from("tour_guides")
    .select("*")
    .eq("owner_email", email)
    .is("company_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TourGuideRow) ?? null;
}
