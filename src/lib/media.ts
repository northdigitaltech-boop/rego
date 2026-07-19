import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";
import { type Listing } from "@/lib/data";
import { updateOrQueue } from "@/lib/pending-edits";

/* ============================================================
 * Row types (match supabase/phase20-media.sql)
 * ============================================================ */

export interface MediaProviderRow {
  id: string;
  company_id: string | null;
  company_name: string | null;
  name: string;
  logo: string | null;
  cover_image: string | null;
  cnic: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  location: string | null;
  areas: string[] | null;
  service_type: string | null;
  experience_years: number | null;
  languages: string[] | null;
  bio: string | null;
  equipment: string | null;
  camera_models: string | null;
  drone_available: boolean;
  drone_license: string | null;
  editing_included: boolean;
  delivery_time: string | null;
  starting_price: number;
  social_links: string[] | null;
  portfolio_link: string | null;
  seasonal_availability: string | null;
  cnic_doc: string | null;
  license_doc: string | null;
  rating: number;
  reviews: number;
  status: string;
  verified: boolean;
  featured: boolean;
  portfolio_views: number;
  owner_email: string | null;
  created_at: string;
}

export interface MediaPortfolioRow {
  id: string;
  provider_id: string | null;
  type: string | null; // photo | video | reel
  url: string;
  caption: string | null;
  title: string | null;
  category: string | null;
  location: string | null;
  project_date: string | null;
  drone_model: string | null;
  camera_quality: string | null;
  services_included: string[] | null;
  description: string | null;
  video_url: string | null;
  gallery: string[] | null;
  owner_email: string | null;
  created_at: string;
}

export const PORTFOLIO_TYPES = ["photo", "video", "reel"] as const;

export const PHOTO_CATEGORIES = [
  "Travel Photography",
  "Mountain Photography",
  "Hotel & Resort Shoots",
  "Restaurant Shoots",
  "Event Coverage",
  "Wedding Shoots",
  "Real Estate Shoots",
  "Tourism Campaigns",
];
export const VIDEO_CATEGORIES = [
  "Travel Videos",
  "Drone Cinematic Videos",
  "Promotional Videos",
  "Event Videos",
  "Wedding Videos",
  "Hotel & Resort Videos",
  "Tourism Destination Videos",
];
export const REEL_CATEGORIES = ["Instagram Reels", "TikTok Videos", "YouTube Shorts"];

export function portfolioCategoriesFor(type: string): string[] {
  if (type === "video") return VIDEO_CATEGORIES;
  if (type === "reel") return REEL_CATEGORIES;
  return PHOTO_CATEGORIES;
}

const PROVIDER_PUBLIC =
  "id,company_id,company_name,name,logo,cover_image,phone,whatsapp,city,location,areas,service_type,experience_years,languages,bio,equipment,camera_models,drone_available,editing_included,delivery_time,starting_price,social_links,portfolio_link,seasonal_availability,rating,reviews,status,verified,featured,ranking_badge,portfolio_views,owner_email,created_at,accept_pay_at_property,require_advance_payment,advance_payment_percentage,accepted_payment_methods,payment_bank_name,payment_account_title,payment_account_number,payment_iban,payment_jazzcash,payment_easypaisa,payment_instructions";

export const SERVICE_TYPES = [
  "Photographer",
  "Videographer",
  "Drone Pilot",
  "Photographer + Videographer",
  "Complete Media Team",
];

export function providerToListing(p: MediaProviderRow): Listing {
  return {
    id: p.id,
    title: p.name,
    category: "photographers",
    categoryLabel: p.service_type || "Photographer",
    location: p.location || p.city || "Gilgit Baltistan",
    price: p.starting_price,
    unit: "shoot",
    rating: Number(p.rating),
    reviews: p.reviews,
    image: p.cover_image || p.logo || "https://picsum.photos/seed/media/900/600",
    provider: p.company_name || undefined,
    featured: p.featured,
  };
}

/* ============================================================
 * Provider
 * ============================================================ */

export async function getMediaProviderByOwner(
  email: string
): Promise<MediaProviderRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from("media_providers")
    .select("*")
    .eq("owner_email", email)
    .is("company_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MediaProviderRow) ?? null;
}

export async function getMediaProviderRowById(
  id: string
): Promise<MediaProviderRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("media_providers")
    .select(PROVIDER_PUBLIC)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as MediaProviderRow;
}

export async function getApprovedMediaProviders(): Promise<MediaProviderRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("media_providers")
    .select(PROVIDER_PUBLIC)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as unknown as MediaProviderRow[]) ?? [];
}

export async function getApprovedMediaByCompany(
  companyId: string
): Promise<MediaProviderRow[]> {
  if (!isSupabaseConfigured || !isUuid(companyId)) return [];
  const { data } = await supabase
    .from("media_providers")
    .select(PROVIDER_PUBLIC)
    .eq("company_id", companyId)
    .eq("status", "approved");
  return (data as unknown as MediaProviderRow[]) ?? [];
}

export async function getMediaByCompany(
  companyId: string
): Promise<MediaProviderRow[]> {
  if (!isSupabaseConfigured || !isUuid(companyId)) return [];
  const { data } = await supabase
    .from("media_providers")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return (data as MediaProviderRow[]) ?? [];
}

export async function getAllMediaProviders(): Promise<MediaProviderRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("media_providers")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as MediaProviderRow[]) ?? [];
}

export async function getPendingMediaProviders(): Promise<MediaProviderRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("media_providers")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as MediaProviderRow[]) ?? [];
}

export type MediaProviderInput = Partial<
  Omit<MediaProviderRow, "id" | "created_at">
> & { name: string };

export async function createMediaProvider(input: MediaProviderInput) {
  return supabase.from("media_providers").insert(input).select().single();
}
export async function updateMediaProvider(
  id: string,
  input: Partial<MediaProviderInput>
) {
  return updateOrQueue("media_providers", id, input as Record<string, unknown>);
}
export async function deleteMediaProvider(id: string) {
  return supabase.from("media_providers").delete().eq("id", id);
}
export async function setMediaProviderStatus(id: string, status: string) {
  return supabase.from("media_providers").update({ status }).eq("id", id);
}
export async function setMediaProviderVerified(id: string, verified: boolean) {
  return supabase.from("media_providers").update({ verified }).eq("id", id);
}
export async function setMediaProviderFeatured(id: string, featured: boolean) {
  return supabase.from("media_providers").update({ featured }).eq("id", id);
}

/* ============================================================
 * Portfolio
 * ============================================================ */

export async function getPortfolioByProvider(
  providerId: string
): Promise<MediaPortfolioRow[]> {
  if (!isSupabaseConfigured || !isUuid(providerId)) return [];
  const { data } = await supabase
    .from("media_portfolio")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  return (data as MediaPortfolioRow[]) ?? [];
}

export type MediaPortfolioInput = Partial<
  Omit<MediaPortfolioRow, "id" | "created_at">
> & { url: string; provider_id: string };

export async function addPortfolioItem(input: MediaPortfolioInput) {
  return supabase.from("media_portfolio").insert(input).select().single();
}
export async function deletePortfolioItem(id: string) {
  return supabase.from("media_portfolio").delete().eq("id", id);
}
