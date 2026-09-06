import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * A team member's own profile and CV.
 *
 * WHO CAN READ IT
 *   Them, and admins. Not colleagues, not a manager holding view_leads.
 *   phase109 enforces that with two policies and no third, so this file
 *   does not filter — there is nothing for it to filter.
 *
 * THE PICTURE IS NOT HERE
 *   It is profiles.avatar, which the navbar and the traveller dashboard
 *   already read. A second avatar column would be a second thing to be out
 *   of date, and the one people notice is always the other one.
 * ============================================================ */

export interface Education {
  qualification: string;
  institution: string;
  year: string;
  note?: string;
}

export interface Experience {
  title: string;
  organisation: string;
  from: string;
  to: string;
  note?: string;
}

export interface Language {
  name: string;
  level: string;
}

export interface StaffCv {
  staff_id: string;
  headline: string | null;
  bio: string | null;
  date_of_birth: string | null;
  gender: string | null;
  personal_email: string | null;
  address: string | null;
  city: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  education: Education[];
  experience: Experience[];
  skills: string[];
  languages: Language[];
  updated_at: string;
}

export const GENDERS = ["female", "male", "other", "undisclosed"] as const;

export const LANGUAGE_LEVELS = [
  "native",
  "fluent",
  "conversational",
  "basic",
] as const;

const COLUMNS =
  "staff_id, headline, bio, date_of_birth, gender, personal_email, address, city, " +
  "emergency_contact_name, emergency_contact_phone, emergency_contact_relation, " +
  "education, experience, skills, languages, updated_at";

/** Their CV, or null when they have not started one. */
export async function getMyCv(staffId: string): Promise<StaffCv | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("staff_profiles")
    .select(COLUMNS)
    .eq("staff_id", staffId)
    .maybeSingle();
  if (error || !data) return null;
  return normalise(data as unknown as Record<string, unknown>);
}

export type CvPatch = Partial<Omit<StaffCv, "staff_id" | "updated_at">>;

/**
 * Upsert, because the first save and every later one are the same act from
 * the person's point of view and splitting them means the screen has to know
 * which it is.
 */
export async function saveMyCv(
  staffId: string,
  patch: CvPatch
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not configured." };

  const { error } = await supabase
    .from("staff_profiles")
    .upsert({ staff_id: staffId, ...clean(patch) }, { onConflict: "staff_id" });

  if (error) {
    if (/row-level security/i.test(error.message)) {
      return { ok: false, error: "That is not your profile." };
    }
    if (/dob_plausible/.test(error.message)) {
      return { ok: false, error: "Check the date of birth — that one is not possible." };
    }
    if (/lists_are_arrays/.test(error.message)) {
      return { ok: false, error: "Something went wrong saving your lists. Please try again." };
    }
    if (/gender_known/.test(error.message)) {
      return { ok: false, error: "Choose one of the listed options." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * The picture, on profiles, where everything else already looks for it.
 *
 * The row is found from the SESSION rather than from an id passed in. The
 * User object the app carries has no id on it, and adding one so a caller
 * could hand it here would be a worse answer than asking the one place that
 * already knows.
 */
export async function saveAvatar(
  url: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not configured." };

  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar: url || null })
    .eq("id", uid);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* Empty strings become null. A column holding "" reads as "they answered,
   with nothing" and is a different thing from "they have not answered". */
function clean(patch: CvPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out;
}

/* The JSONB columns are whatever was last written. Anything that is not a
   list is replaced with one, so a single bad row cannot make every consumer
   defensive. */
function normalise(row: Record<string, unknown>): StaffCv {
  const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    ...(row as unknown as StaffCv),
    education: list<Education>(row.education),
    experience: list<Experience>(row.experience),
    skills: list<string>(row.skills).filter((s) => typeof s === "string"),
    languages: list<Language>(row.languages),
  };
}
