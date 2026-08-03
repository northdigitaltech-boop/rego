import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Sponsored slides for the homepage promotion carousel (phase 64).
 * Admin-managed: image, copy, badges, CTA, schedule and order.
 * ============================================================ */

export interface AdSlideRow {
  id: string;
  image: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  badges: string[] | null;
  cta_label: string | null;
  cta_href: string | null;
  cta_external: boolean;
  advertiser: string | null;
  active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AdSlideInput = Partial<Omit<AdSlideRow, "id" | "created_at" | "updated_at">> & {
  image: string;
  title: string;
};

/** Is the slide inside its scheduled window (blank dates = always on)? */
function inWindow(s: AdSlideRow): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (s.starts_at && s.starts_at > today) return false;
  if (s.ends_at && s.ends_at < today) return false;
  return true;
}

/** Live slides for the public carousel — active and in date, in admin order. */
export async function getActiveAdSlides(): Promise<AdSlideRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("ad_slides")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as AdSlideRow[]).filter(inWindow);
}

/** Every slide, for the admin table. */
export async function getAllAdSlides(): Promise<AdSlideRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("ad_slides")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as AdSlideRow[];
}

export async function createAdSlide(input: AdSlideInput) {
  return supabase.from("ad_slides").insert(input);
}

export async function updateAdSlide(id: string, patch: Partial<AdSlideRow>) {
  return supabase.from("ad_slides").update(patch).eq("id", id);
}

export async function deleteAdSlide(id: string) {
  return supabase.from("ad_slides").delete().eq("id", id);
}
