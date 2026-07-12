import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type PromotionStatus =
  | "draft" | "pending" | "scheduled" | "active" | "expired" | "rejected" | "paused";

export interface PromotionRow {
  id: string;
  owner_email: string;
  listing_id: string | null;
  listing_type: string | null;
  title: string;
  description: string | null;
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  image_url: string | null;
  cta_label: string | null;
  terms: string | null;
  quantity: number | null;
  eligibility: string | null;
  start_date: string | null;
  end_date: string | null;
  status: PromotionStatus | string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionInput {
  owner_email: string;
  listing_id?: string | null;
  listing_type?: string | null;
  title: string;
  description?: string | null;
  original_price: number;
  discounted_price: number;
  image_url?: string | null;
  cta_label?: string | null;
  terms?: string | null;
  quantity?: number | null;
  eligibility?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: PromotionStatus;
}

const norm = (e: string) => e.trim().toLowerCase();

/** Auto-calculate the discount percentage (never trust a client value). */
export function computeDiscountPct(original: number, discounted: number): number {
  if (!original || original <= 0 || discounted < 0 || discounted > original) return 0;
  return Math.round(((original - discounted) / original) * 100);
}

export async function createPromotion(input: PromotionInput) {
  const discount_percentage = computeDiscountPct(input.original_price, input.discounted_price);
  return supabase.from("promotions").insert({
    owner_email: norm(input.owner_email),
    listing_id: input.listing_id ?? null,
    listing_type: input.listing_type ?? null,
    title: input.title,
    description: input.description ?? null,
    original_price: input.original_price,
    discounted_price: input.discounted_price,
    discount_percentage,
    image_url: input.image_url ?? null,
    cta_label: input.cta_label ?? null,
    terms: input.terms ?? null,
    quantity: input.quantity ?? null,
    eligibility: input.eligibility ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    status: input.status ?? "pending",
  });
}

export async function updatePromotion(id: string, input: Partial<PromotionInput>) {
  const patch: Record<string, unknown> = { ...input };
  if (input.original_price != null && input.discounted_price != null) {
    patch.discount_percentage = computeDiscountPct(input.original_price, input.discounted_price);
  }
  return supabase.from("promotions").update(patch).eq("id", id);
}

export async function setPromotionStatus(id: string, status: PromotionStatus, adminEmail?: string) {
  const patch: Record<string, unknown> = { status };
  if (status === "active" || status === "rejected") {
    patch.approved_by = adminEmail ?? null;
    patch.approved_at = new Date().toISOString();
  }
  return supabase.from("promotions").update(patch).eq("id", id);
}

export async function getPromotionsByOwner(email: string): Promise<PromotionRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("promotions")
    .select("*")
    .eq("owner_email", norm(email))
    .order("created_at", { ascending: false });
  return (data ?? []) as PromotionRow[];
}

export async function getPendingPromotions(): Promise<PromotionRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("promotions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []) as PromotionRow[];
}

export async function getAllPromotions(): Promise<PromotionRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
  return (data ?? []) as PromotionRow[];
}

/** Public: currently-active, non-expired promotions for the recommendations UI. */
export async function getActivePromotions(limit = 12): Promise<PromotionRow[]> {
  if (!isSupabaseConfigured) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("promotions")
    .select("*")
    .eq("status", "active")
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order("discount_percentage", { ascending: false })
    .limit(limit);
  return (data ?? []) as PromotionRow[];
}

/* ---------------- price history (fake-discount audit trail) ---------------- */
export async function recordPriceChange(
  listingId: string,
  listingType: string,
  oldPrice: number | null,
  newPrice: number | null,
  changedBy?: string
) {
  return supabase.from("price_history").insert({
    listing_id: listingId,
    listing_type: listingType,
    old_price: oldPrice,
    new_price: newPrice,
    changed_by: changedBy ?? null,
  });
}

export async function getPriceHistory(listingId: string, listingType: string) {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("price_history")
    .select("*")
    .eq("listing_id", listingId)
    .eq("listing_type", listingType)
    .order("changed_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
