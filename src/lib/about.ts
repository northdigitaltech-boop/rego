import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { aboutContent as defaultAboutContent, type AboutContent } from "@/lib/about-content";

export { defaultAboutContent };
export type { AboutContent };

/**
 * Returns the About Us content: admin-edited values from Supabase when present,
 * otherwise the built-in defaults. Top-level keys are merged so any section
 * added to the defaults later still renders even if the stored row is older.
 */
export async function getAboutContent(): Promise<AboutContent> {
  if (!isSupabaseConfigured) return defaultAboutContent;
  try {
    const { data, error } = await supabase
      .from("about_content")
      .select("content")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data?.content) return defaultAboutContent;
    return { ...defaultAboutContent, ...(data.content as Partial<AboutContent>) } as AboutContent;
  } catch {
    return defaultAboutContent;
  }
}

/** Upsert the full About Us content document (admin only, app-gated). */
export async function saveAboutContent(content: AboutContent) {
  return supabase
    .from("about_content")
    .upsert({ id: 1, content, updated_at: new Date().toISOString() });
}
