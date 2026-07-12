import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";

/* ============================================================
 * Safarnama — Traveler Stories data layer
 * Matches supabase/phase43-safarnama.sql
 * ============================================================ */

export const TRAVEL_TYPES = [
  { slug: "road-trip", label: "Road Trip" },
  { slug: "family", label: "Family Travel" },
  { slug: "solo", label: "Solo Traveler" },
  { slug: "adventure", label: "Adventure" },
  { slug: "budget", label: "Budget Travel" },
  { slug: "luxury", label: "Luxury" },
  { slug: "cultural", label: "Cultural" },
  { slug: "honeymoon", label: "Honeymoon" },
  { slug: "group", label: "Group Tour" },
] as const;

export function travelTypeLabel(slug: string): string {
  return TRAVEL_TYPES.find((t) => t.slug === slug)?.label ?? slug;
}

export const STORY_CITIES = [
  "Skardu",
  "Hunza",
  "Gilgit",
  "Fairy Meadows",
  "Naltar",
  "Khunjerab",
  "Deosai",
  "Shigar",
  "Ghizer",
  "Astore",
  "Nagar",
  "Chilas",
] as const;

export interface StoryTimelineItem {
  title: string;
  date: string;
  note: string;
}
export interface StoryBudgetItem {
  label: string;
  amount: string;
}

export interface StoryRow {
  id: string;
  owner_email: string | null;
  author_name: string | null;
  author_avatar: string | null;
  title: string;
  cover_image: string | null;
  destination: string | null;
  city: string | null;
  trip_date: string | null;
  duration: string | null;
  travel_type: string | null;
  budget: string | null;
  transportation: string | null;
  hotels: string[] | null;
  places_visited: string[] | null;
  restaurants: string[] | null;
  best_experience: string | null;
  problems_faced: string | null;
  travel_tips: string | null;
  road_condition: string | null;
  food_recommendations: string | null;
  story: string | null;
  preview: string | null;
  gallery: string[] | null;
  videos: string[] | null;
  timeline: StoryTimelineItem[] | null;
  budget_breakdown: StoryBudgetItem[] | null;
  rating: number;
  reading_time: number;
  likes: number;
  comments: number;
  views: number;
  verified: boolean;
  featured: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StoryCommentRow {
  id: string;
  story_id: string;
  user_email: string;
  user_name: string | null;
  user_avatar: string | null;
  text: string;
  hidden: boolean;
  created_at: string;
}

const PUBLIC_COLS =
  "id,owner_email,author_name,author_avatar,title,cover_image,destination,city,trip_date,duration,travel_type,budget,transportation,hotels,places_visited,restaurants,best_experience,problems_faced,travel_tips,road_condition,food_recommendations,story,preview,gallery,videos,timeline,budget_breakdown,rating,reading_time,likes,comments,views,verified,featured,status,created_at,updated_at";

/* ---------------- Helpers ---------------- */

export function readingTime(text: string): number {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function makePreview(text: string, max = 180): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max).trimEnd() + "…" : clean;
}

/* ---------------- Stories: reads ---------------- */

export async function getApprovedStories(): Promise<StoryRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("stories")
    .select(PUBLIC_COLS)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as unknown as StoryRow[]) ?? [];
}

export async function getStoryById(id: string): Promise<StoryRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data } = await supabase
    .from("stories")
    .select(PUBLIC_COLS)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as StoryRow) ?? null;
}

export async function getAllStories(): Promise<StoryRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("stories")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as StoryRow[]) ?? [];
}

export async function getMyStories(email: string): Promise<StoryRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data } = await supabase
    .from("stories")
    .select(PUBLIC_COLS)
    .eq("owner_email", email)
    .order("created_at", { ascending: false });
  return (data as unknown as StoryRow[]) ?? [];
}

export async function getRelatedStories(
  story: StoryRow,
  n = 3
): Promise<StoryRow[]> {
  const all = await getApprovedStories();
  return all
    .filter((s) => s.id !== story.id)
    .sort((a, b) => {
      const score = (x: StoryRow) =>
        (x.travel_type === story.travel_type ? 2 : 0) +
        (x.city && x.city === story.city ? 2 : 0);
      return score(b) - score(a) || b.views - a.views;
    })
    .slice(0, n);
}

/* ---------------- Stories: writes ---------------- */

export type StoryInput = Partial<
  Omit<StoryRow, "id" | "created_at" | "updated_at">
> & { title: string };

export async function createStory(input: StoryInput) {
  return supabase.from("stories").insert(input).select().single();
}
export async function updateStory(id: string, input: Partial<StoryInput>) {
  return supabase
    .from("stories")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function deleteStory(id: string) {
  return supabase.from("stories").delete().eq("id", id);
}
export async function setStoryStatus(id: string, status: "approved" | "rejected" | "pending") {
  return supabase
    .from("stories")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
}
export async function setStoryFeatured(id: string, featured: boolean) {
  return supabase.from("stories").update({ featured }).eq("id", id);
}
export async function setStoryVerified(id: string, verified: boolean) {
  return supabase.from("stories").update({ verified }).eq("id", id);
}

export async function bumpStoryViews(id: string) {
  if (!isSupabaseConfigured || !isUuid(id)) return;
  await supabase.rpc("bump_story_views", { p_story: id });
}

/* ---------------- Likes ---------------- */

export async function hasLiked(storyId: string, email: string): Promise<boolean> {
  if (!isSupabaseConfigured || !email) return false;
  const { data } = await supabase
    .from("story_likes")
    .select("id")
    .eq("story_id", storyId)
    .eq("user_email", email)
    .maybeSingle();
  return !!data;
}

/** Toggle a like; returns the new liked state. */
export async function toggleLike(storyId: string, email: string): Promise<boolean> {
  if (!isSupabaseConfigured || !email) return false;
  const liked = await hasLiked(storyId, email);
  if (liked) {
    await supabase.from("story_likes").delete().eq("story_id", storyId).eq("user_email", email);
    return false;
  }
  await supabase.from("story_likes").insert({ story_id: storyId, user_email: email });
  return true;
}

/* ---------------- Comments ---------------- */

export async function getStoryComments(storyId: string): Promise<StoryCommentRow[]> {
  if (!isSupabaseConfigured || !isUuid(storyId)) return [];
  const { data } = await supabase
    .from("story_comments")
    .select("*")
    .eq("story_id", storyId)
    .eq("hidden", false)
    .order("created_at", { ascending: false });
  return (data as StoryCommentRow[]) ?? [];
}

export async function getAllComments(): Promise<StoryCommentRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("story_comments")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as StoryCommentRow[]) ?? [];
}

export async function addComment(input: {
  story_id: string;
  user_email: string;
  user_name: string | null;
  user_avatar: string | null;
  text: string;
}) {
  return supabase.from("story_comments").insert(input).select().single();
}

export async function setCommentHidden(id: string, hidden: boolean) {
  return supabase.from("story_comments").update({ hidden }).eq("id", id);
}
export async function deleteComment(id: string) {
  return supabase.from("story_comments").delete().eq("id", id);
}
