import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Admin-assigned ranking badge shown on listing detail pages.
 * "" means no badge. Kept short and curated (rendered as escaped text).
 *
 * NOTE: who may set this is gated by the admin UI only. DB-level enforcement
 * ("admin role required") is not real until the Supabase Auth migration (C1).
 */
export const RANKING_OPTIONS = [
  "",
  "Top Rated",
  "Popular",
  "Editor's Choice",
  "Best Value",
  "New",
] as const;

export async function setRankingBadge(table: string, id: string, badge: string) {
  if (!isSupabaseConfigured) return;
  // Cap length defensively; admin-set, React-escaped on display.
  const value = badge ? badge.slice(0, 30) : null;
  return supabase.from(table).update({ ranking_badge: value }).eq("id", id);
}
