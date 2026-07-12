import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type PriceAlertType = "decrease" | "target" | "availability" | "any_offer";

export interface PriceAlertRow {
  id: string;
  user_email: string;
  listing_id: string;
  listing_type: string;
  current_price: number | null;
  target_price: number | null;
  alert_type: PriceAlertType | string;
  is_active: boolean;
  created_at: string;
  triggered_at: string | null;
}

export interface PriceAlertInput {
  user_email: string;
  listing_id: string;
  listing_type: string;
  current_price?: number | null;
  target_price?: number | null;
  alert_type: PriceAlertType;
}

const norm = (e: string) => e.trim().toLowerCase();

export async function createPriceAlert(input: PriceAlertInput) {
  return supabase.from("price_alerts").insert({
    user_email: norm(input.user_email),
    listing_id: input.listing_id,
    listing_type: input.listing_type,
    current_price: input.current_price ?? null,
    target_price: input.target_price ?? null,
    alert_type: input.alert_type,
    is_active: true,
  });
}

export async function getPriceAlertsByUser(email: string): Promise<PriceAlertRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("user_email", norm(email))
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return (data ?? []) as PriceAlertRow[];
}

/** Active alerts watching a given listing (used by price-drop triggers). */
export async function getActiveAlertsForListing(listingId: string, listingType: string): Promise<PriceAlertRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("listing_id", listingId)
    .eq("listing_type", listingType)
    .eq("is_active", true);
  return (data ?? []) as PriceAlertRow[];
}

export async function deactivatePriceAlert(id: string) {
  return supabase.from("price_alerts").update({ is_active: false }).eq("id", id);
}

export async function markAlertTriggered(id: string) {
  return supabase.from("price_alerts").update({ triggered_at: new Date().toISOString() }).eq("id", id);
}
