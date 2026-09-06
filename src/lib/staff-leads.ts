import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Leads and the activity log.
 *
 * WHY THERE IS NO API ROUTE HERE
 *   Team Management writes through /api/admin/staff because those rows decide
 *   who may do what, and a service-role client is the only honest place for
 *   that. Leads are different: every rule is expressible in RLS, and phase107
 *   expresses it. staff_id and created_by are checked against the CALLER in
 *   the with-check clause, so a forged request is refused by Postgres rather
 *   than by a route that has to remember to check.
 *
 *   That is enforcement at the database level, which is what the brief asks
 *   for. Adding a route in front of it would be a second place for the same
 *   rule to live and drift.
 * ============================================================ */

export const LEAD_STAGES = [
  "new",
  "contacted",
  "interested",
  "registered",
  "lost",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  registered: "Registered",
  lost: "Lost",
};

export const ACTIVITY_KINDS = [
  "call",
  "whatsapp",
  "visit",
  "meeting",
  "email",
  "note",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface Lead {
  id: string;
  staff_id: string;
  department_id: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  category: string | null;
  location_id: string | null;
  stage: LeadStage;
  source: string | null;
  note: string | null;
  next_follow_up: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  staff_id: string;
  lead_id: string | null;
  kind: ActivityKind;
  happened_at: string;
  note: string | null;
}

const COLUMNS =
  "id, staff_id, department_id, business_name, contact_name, phone, whatsapp, " +
  "email, category, location_id, stage, source, note, next_follow_up, " +
  "created_at, updated_at";

export interface LeadResult {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Every lead the caller may see. RLS decides what that means — their own, and
 * their department's if their role carries view_leads. This function does not
 * filter by person, on purpose: doing it here as well would mean two places
 * decide, and only one of them is enforceable.
 */
export async function listLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("staff_leads")
    .select(COLUMNS)
    .order("next_follow_up", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as Lead[];
}

export async function createLead(input: {
  staffId: string;
  departmentId: string;
  businessName: string;
  contactName?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  category?: string;
  source?: string;
  note?: string;
  nextFollowUp?: string;
}): Promise<LeadResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not configured." };

  /* Read from the session rather than taken as an argument. created_by has to
     equal auth.uid() or the insert policy refuses it, so letting a caller
     supply it only creates a way to get it wrong. */
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return { ok: false, error: "Please sign in again." };

  const { data, error } = await supabase
    .from("staff_leads")
    .insert({
      /* Sent because the columns are NOT NULL, not because they are trusted.
         The insert policy compares both against the caller and refuses a
         mismatch, so a forged value fails rather than succeeding quietly. */
      staff_id: input.staffId,
      department_id: input.departmentId,
      created_by: uid,
      business_name: input.businessName.trim(),
      contact_name: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      category: input.category?.trim() || null,
      source: input.source?.trim() || null,
      note: input.note?.trim() || null,
      next_follow_up: input.nextFollowUp || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateLead(
  id: string,
  patch: Partial<{
    business_name: string;
    contact_name: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    category: string | null;
    stage: LeadStage;
    source: string | null;
    note: string | null;
    next_follow_up: string | null;
  }>
): Promise<LeadResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not configured." };
  /* staff_id is absent from the patch type on purpose: the update policy
     would refuse a hand-over anyway, and offering it here would produce a
     button that always fails. */
  const { error } = await supabase.from("staff_leads").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true };
}

export async function listActivities(leadId: string): Promise<Activity[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("staff_activities")
    .select("id, staff_id, lead_id, kind, happened_at, note")
    .eq("lead_id", leadId)
    .order("happened_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as Activity[];
}

/**
 * Add to the log. There is no edit and no delete, here or in the database —
 * a log somebody can revise after the fact answers a different question from
 * the one it was kept for.
 */
export async function logActivity(input: {
  staffId: string;
  leadId?: string | null;
  kind: ActivityKind;
  note?: string;
  happenedAt?: string;
}): Promise<LeadResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not configured." };
  const { error } = await supabase.from("staff_activities").insert({
    staff_id: input.staffId,
    lead_id: input.leadId ?? null,
    kind: input.kind,
    note: input.note?.trim() || null,
    happened_at: input.happenedAt || new Date().toISOString(),
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true };
}

/**
 * RLS refusals arrive as "new row violates row-level security policy", which
 * tells somebody nothing about what to do. Translate the ones that have a
 * real cause and leave the rest alone rather than inventing a diagnosis.
 */
function friendly(message: string): string {
  if (/row-level security/i.test(message)) {
    return "Your role does not allow that, or the record is not yours. If that seems wrong, ask an admin to check your permissions.";
  }
  if (/staff_leads_stage_known/.test(message)) return "That is not a valid stage.";
  if (/staff_leads_name_present/.test(message)) return "The business name is required.";
  return message;
}
