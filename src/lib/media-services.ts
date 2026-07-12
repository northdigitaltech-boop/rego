import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";

export interface MediaServiceRow {
  id: string;
  provider_id: string | null;
  title: string;
  description: string | null;
  price: number;
  duration: string | null;
  deliverables: string | null;
  edited_photos: number | null;
  videos: number | null;
  raw_files: boolean;
  drone_included: boolean;
  area: string | null;
  owner_email: string | null;
  created_at: string;
}

export const MEDIA_SERVICE_PRESETS = [
  "Wedding Shoot",
  "Couple Shoot",
  "Family Shoot",
  "Travel Shoot",
  "Hotel / Resort Shoot",
  "Tour Company Shoot",
  "Drone Shoot",
  "Reel / Short Video",
  "Full Travel Video",
  "Event Coverage",
  "Product / Food Shoot",
  "Custom Shoot",
];

export async function getMediaServicesByProvider(
  providerId: string
): Promise<MediaServiceRow[]> {
  if (!isSupabaseConfigured || !isUuid(providerId)) return [];
  const { data } = await supabase
    .from("media_services")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: true });
  return (data as MediaServiceRow[]) ?? [];
}

export type MediaServiceInput = Partial<
  Omit<MediaServiceRow, "id" | "created_at">
> & { title: string; provider_id: string };

export async function createMediaService(input: MediaServiceInput) {
  return supabase.from("media_services").insert(input).select().single();
}
export async function updateMediaService(
  id: string,
  input: Partial<MediaServiceInput>
) {
  return supabase.from("media_services").update(input).eq("id", id);
}
export async function deleteMediaService(id: string) {
  return supabase.from("media_services").delete().eq("id", id);
}
