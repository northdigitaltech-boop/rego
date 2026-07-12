import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";
import { type Listing } from "@/lib/data";

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */
export interface ExpeditionCompanyRow {
  id: string;
  owner_email: string | null;
  name: string;
  logo: string | null;
  cover_image: string | null;
  description: string | null;
  year_established: number | null;
  reg_number: string | null;
  license_number: string | null;
  tourism_reg: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  socials: Record<string, string>;
  languages: string[] | null;
  years_experience: number | null;
  expeditions_organized: number | null;
  treks_organized: number | null;
  successful_count: number | null;
  peaks_handled: string[] | null;
  routes_handled: string[] | null;
  intl_clients: number | null;
  certifications: string[] | null;
  licenses: string[] | null;
  awards: string[] | null;
  insurance_info: string | null;
  safety_policy: string | null;
  rescue_capability: boolean;
  emergency_support: string | null;
  services: string[] | null;
  starting_price: number | null;
  currency: string;
  rating: number;
  reviews: number;
  gallery: string[] | null;
  verified: boolean;
  featured: boolean;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface ExpeditionProRow {
  id: string;
  owner_email: string | null;
  full_name: string;
  photo: string | null;
  cover_image: string | null;
  title: string | null;
  role: string | null;
  short_bio: string | null;
  bio: string | null;
  age_range: string | null;
  gender: string | null;
  nationality: string | null;
  home_village: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  languages: string[] | null;
  years_experience: number | null;
  total_expeditions: number | null;
  total_treks: number | null;
  highest_altitude_m: number | null;
  highest_peak: string | null;
  peaks_summited: string[] | null;
  peaks_worked: string[] | null;
  routes_completed: string[] | null;
  successful_expeditions: number | null;
  previous_companies: string[] | null;
  intl_experience: boolean;
  specializations: string[] | null;
  skills: string[] | null;
  availability_status: string | null;
  daily_rate: number | null;
  package_rate: number | null;
  currency: string;
  min_days: number | null;
  max_days: number | null;
  negotiable: boolean;
  services_included: string[] | null;
  services_excluded: string[] | null;
  carrying_capacity_kg: number | null;
  max_altitude_m: number | null;
  equipment_owned: string[] | null;
  equipment_required: string[] | null;
  available_locations: string[] | null;
  available_peaks: string[] | null;
  available_routes: string[] | null;
  custom_quote: boolean;
  gallery: string[] | null;
  role_fields: Record<string, unknown>;
  public_certs: string[] | null;
  verified: boolean;
  featured: boolean;
  status: string;
  rating: number;
  reviews: number;
  created_at: string;
  updated_at?: string;
}

export interface ExpeditionRole { id: string; slug: string; name: string; active: boolean; display_order: number }
export interface ExpeditionPeak { id: string; name: string; region: string | null; height_m: number | null; active: boolean; display_order: number }
export interface ExpeditionRoute { id: string; name: string; region: string | null; active: boolean; display_order: number }

/* Public column lists — deliberately EXCLUDE private_docs so verification
   documents are never returned to the browser. */
const COMPANY_PUBLIC =
  "id,owner_email,name,logo,cover_image,description,year_established,address,city,district,country,phone,whatsapp,email,website,socials,languages,years_experience,expeditions_organized,treks_organized,successful_count,peaks_handled,routes_handled,intl_clients,certifications,licenses,awards,insurance_info,safety_policy,rescue_capability,emergency_support,services,starting_price,currency,rating,reviews,gallery,verified,featured,status,created_at";
const PRO_PUBLIC =
  "id,owner_email,full_name,photo,cover_image,title,role,short_bio,bio,age_range,gender,nationality,home_village,city,district,country,phone,whatsapp,email,languages,years_experience,total_expeditions,total_treks,highest_altitude_m,highest_peak,peaks_summited,peaks_worked,routes_completed,successful_expeditions,previous_companies,intl_experience,specializations,skills,availability_status,daily_rate,package_rate,currency,min_days,max_days,negotiable,services_included,services_excluded,carrying_capacity_kg,max_altitude_m,equipment_owned,equipment_required,available_locations,available_peaks,available_routes,custom_quote,gallery,role_fields,public_certs,verified,featured,status,rating,reviews,created_at";

const norm = (e?: string | null) => (e ?? "").trim().toLowerCase();

/* ================================================================== */
/* Listing mappers (for the shared /listings + cards)                  */
/* ================================================================== */
export function companyToListing(c: ExpeditionCompanyRow): Listing {
  return {
    id: c.id,
    title: c.name,
    category: "mountaineering",
    category_label: "Expedition Company",
    location: c.city || c.district || "Gilgit-Baltistan",
    price: c.starting_price ?? 0,
    unit: "expedition",
    rating: c.rating,
    reviews: c.reviews,
    image: c.logo || c.cover_image || (c.gallery?.[0] ?? null),
    featured: c.featured,
    provider: undefined,
  } as unknown as Listing;
}

export function proToListing(p: ExpeditionProRow): Listing {
  return {
    id: p.id,
    title: p.full_name,
    category: "mountaineering",
    category_label: p.title || "Expedition Professional",
    location: p.city || p.home_village || "Gilgit-Baltistan",
    price: p.daily_rate ?? 0,
    unit: "day",
    rating: p.rating,
    reviews: p.reviews,
    image: p.photo || p.cover_image || (p.gallery?.[0] ?? null),
    featured: p.featured,
  } as unknown as Listing;
}

/* ================================================================== */
/* Reference lists (peaks / routes / roles)                            */
/* ================================================================== */
export async function getRoles(activeOnly = true): Promise<ExpeditionRole[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase.from("expedition_roles").select("*").order("display_order");
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as ExpeditionRole[];
}
export async function getPeaks(activeOnly = true): Promise<ExpeditionPeak[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase.from("expedition_peaks").select("*").order("display_order");
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as ExpeditionPeak[];
}
export async function getRoutes(activeOnly = true): Promise<ExpeditionRoute[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase.from("expedition_routes").select("*").order("display_order");
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as ExpeditionRoute[];
}

/* ================================================================== */
/* Companies                                                           */
/* ================================================================== */
export async function getApprovedCompanies(): Promise<ExpeditionCompanyRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("expedition_companies").select(COMPANY_PUBLIC)
    .eq("status", "approved").order("featured", { ascending: false }).order("created_at", { ascending: false });
  return (data ?? []) as ExpeditionCompanyRow[];
}
export async function getAllCompanies(): Promise<ExpeditionCompanyRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("expedition_companies").select(COMPANY_PUBLIC).order("created_at", { ascending: false });
  return (data ?? []) as ExpeditionCompanyRow[];
}
export async function getPendingCompanies(): Promise<ExpeditionCompanyRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("expedition_companies").select(COMPANY_PUBLIC).eq("status", "pending").order("created_at", { ascending: false });
  return (data ?? []) as ExpeditionCompanyRow[];
}
export async function getCompanyById(id: string): Promise<ExpeditionCompanyRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data } = await supabase.from("expedition_companies").select(COMPANY_PUBLIC).eq("id", id).maybeSingle();
  return (data as ExpeditionCompanyRow) ?? null;
}
export async function getCompanyByOwner(email: string): Promise<ExpeditionCompanyRow | null> {
  if (!isSupabaseConfigured || !email) return null;
  const { data } = await supabase.from("expedition_companies").select(COMPANY_PUBLIC).eq("owner_email", norm(email)).maybeSingle();
  return (data as ExpeditionCompanyRow) ?? null;
}
export type ExpeditionCompanyInput = Partial<Omit<ExpeditionCompanyRow, "id" | "created_at">>;
export async function createCompany(input: ExpeditionCompanyInput) {
  return supabase.from("expedition_companies").insert({ ...input, owner_email: norm(input.owner_email), status: input.status ?? "pending" });
}
export async function updateCompany(id: string, input: ExpeditionCompanyInput) {
  return supabase.from("expedition_companies").update(input).eq("id", id);
}
export async function setCompanyStatus(id: string, status: string) { return supabase.from("expedition_companies").update({ status }).eq("id", id); }
export async function setCompanyVerified(id: string, verified: boolean) { return supabase.from("expedition_companies").update({ verified }).eq("id", id); }
export async function setCompanyFeatured(id: string, featured: boolean) { return supabase.from("expedition_companies").update({ featured }).eq("id", id); }

/* ================================================================== */
/* Professionals                                                       */
/* ================================================================== */
export async function getApprovedPros(role?: string): Promise<ExpeditionProRow[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase.from("expedition_professionals").select(PRO_PUBLIC).eq("status", "approved");
  if (role) q = q.eq("role", role);
  const { data } = await q.order("featured", { ascending: false }).order("created_at", { ascending: false });
  return (data ?? []) as ExpeditionProRow[];
}
export async function getAllPros(): Promise<ExpeditionProRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("expedition_professionals").select(PRO_PUBLIC).order("created_at", { ascending: false });
  return (data ?? []) as ExpeditionProRow[];
}
export async function getPendingPros(): Promise<ExpeditionProRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("expedition_professionals").select(PRO_PUBLIC).eq("status", "pending").order("created_at", { ascending: false });
  return (data ?? []) as ExpeditionProRow[];
}
export async function getProById(id: string): Promise<ExpeditionProRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data } = await supabase.from("expedition_professionals").select(PRO_PUBLIC).eq("id", id).maybeSingle();
  return (data as ExpeditionProRow) ?? null;
}
export async function getProByOwner(email: string): Promise<ExpeditionProRow | null> {
  if (!isSupabaseConfigured || !email) return null;
  const { data } = await supabase.from("expedition_professionals").select(PRO_PUBLIC).eq("owner_email", norm(email)).maybeSingle();
  return (data as ExpeditionProRow) ?? null;
}
export type ExpeditionProInput = Partial<Omit<ExpeditionProRow, "id" | "created_at">>;
export async function createPro(input: ExpeditionProInput) {
  return supabase.from("expedition_professionals").insert({ ...input, owner_email: norm(input.owner_email), status: input.status ?? "pending" });
}
export async function updatePro(id: string, input: ExpeditionProInput) {
  return supabase.from("expedition_professionals").update(input).eq("id", id);
}
export async function setProStatus(id: string, status: string) { return supabase.from("expedition_professionals").update({ status }).eq("id", id); }
export async function setProVerified(id: string, verified: boolean) { return supabase.from("expedition_professionals").update({ verified }).eq("id", id); }
export async function setProFeatured(id: string, featured: boolean) { return supabase.from("expedition_professionals").update({ featured }).eq("id", id); }

/* ================================================================== */
/* Admin CRUD for the dynamic reference lists                          */
/* ================================================================== */
export async function saveRole(r: { id?: string; slug: string; name: string; active?: boolean; display_order?: number }) {
  if (r.id) return supabase.from("expedition_roles").update(r).eq("id", r.id);
  return supabase.from("expedition_roles").insert(r);
}
export async function deleteRole(id: string) { return supabase.from("expedition_roles").delete().eq("id", id); }

export async function savePeak(p: { id?: string; name: string; region?: string | null; height_m?: number | null; active?: boolean; display_order?: number }) {
  if (p.id) return supabase.from("expedition_peaks").update(p).eq("id", p.id);
  return supabase.from("expedition_peaks").insert(p);
}
export async function deletePeak(id: string) { return supabase.from("expedition_peaks").delete().eq("id", id); }

export async function saveRoute(r: { id?: string; name: string; region?: string | null; active?: boolean; display_order?: number }) {
  if (r.id) return supabase.from("expedition_routes").update(r).eq("id", r.id);
  return supabase.from("expedition_routes").insert(r);
}
export async function deleteRoute(id: string) { return supabase.from("expedition_routes").delete().eq("id", id); }

/** Role slug → display name helper for cards/profiles. */
export function roleName(roles: ExpeditionRole[], slug?: string | null): string {
  if (!slug) return "Expedition Professional";
  return roles.find((r) => r.slug === slug)?.name ?? slug;
}

/** A provider's expedition profile type, derived from which row they own. */
export async function getExpeditionProfileType(email: string): Promise<"company" | "individual" | null> {
  if (!isSupabaseConfigured || !email) return null;
  if (await getCompanyByOwner(email)) return "company";
  if (await getProByOwner(email)) return "individual";
  return null;
}
