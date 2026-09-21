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

/**
 * Where a featured listing sits in its home page row. 1 is first.
 *
 * An empty box clears the position rather than storing 0 — the
 * database refuses anything below 1 (phase137), and "no position" is a
 * real state meaning "put it after the numbered ones, sorted by
 * rating". Non-numeric input clears it for the same reason: a position
 * nobody can read is worse than none.
 *
 * The cap is arbitrary but finite. A row shows four or five cards, so
 * any number past a couple of hundred is a typo, and letting it
 * through would store a value no sort will ever reach.
 */
export async function setFeaturedOrder(
  table: string,
  id: string,
  order: number | null
) {
  if (!isSupabaseConfigured) return;
  const n = Number(order);
  const value = Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 999) : null;
  return supabase.from(table).update({ featured_order: value }).eq("id", id);
}
