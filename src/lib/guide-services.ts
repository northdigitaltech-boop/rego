import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";

export interface GuideServiceRow {
  id: string;
  guide_id: string | null;
  title: string;
  description: string | null;
  price: number;
  duration: string | null;
  area: string | null;
  owner_email: string | null;
  created_at: string;
}

export const GUIDE_SERVICE_PRESETS = [
  "Full Day Guide",
  "Half Day Guide",
  "Trekking Guide",
  "City Tour Guide",
  "Cultural Tour Guide",
  "Custom Tour Assistance",
  "Airport / Hotel Assistance",
  "Translation Assistance",
  "Family Trip Assistance",
];

export async function getServicesByGuide(
  guideId: string
): Promise<GuideServiceRow[]> {
  if (!isSupabaseConfigured || !isUuid(guideId)) return [];
  const { data } = await supabase
    .from("guide_services")
    .select("*")
    .eq("guide_id", guideId)
    .order("created_at", { ascending: true });
  return (data as GuideServiceRow[]) ?? [];
}

export type GuideServiceInput = Partial<
  Omit<GuideServiceRow, "id" | "created_at">
> & { title: string; guide_id: string };

export async function createGuideService(input: GuideServiceInput) {
  return supabase.from("guide_services").insert(input).select().single();
}
export async function updateGuideService(
  id: string,
  input: Partial<GuideServiceInput>
) {
  return supabase.from("guide_services").update(input).eq("id", id);
}
export async function deleteGuideService(id: string) {
  return supabase.from("guide_services").delete().eq("id", id);
}
