import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Blocking and reporting.
 *
 * Blocks are private and one-directional — the blocked person is never
 * notified and sees no change. Reports are visible only to admins, so
 * reporting is safe: the reported party can never learn who filed it.
 *
 * Requires supabase/phase66-safety.sql.
 * ============================================================ */

export type ReportTargetType =
  | "solo"
  | "listing"
  | "story"
  | "review"
  | "message"
  | "job";

export const REPORT_REASONS: { id: string; label: string; hint?: string }[] = [
  { id: "fake", label: "Fake or impersonating someone" },
  { id: "harassment", label: "Harassment or abusive messages" },
  { id: "inappropriate", label: "Inappropriate or sexual content" },
  { id: "scam", label: "Scam, fraud or asking for money" },
  { id: "unsafe", label: "Unsafe or dangerous behaviour" },
  { id: "minor", label: "I think this person is under 18" },
  { id: "spam", label: "Spam or advertising" },
  { id: "wrong-info", label: "Wrong or misleading information" },
  { id: "other", label: "Something else" },
];

export interface ReportInput {
  reporterEmail: string;
  targetType: ReportTargetType;
  targetId: string;
  targetEmail?: string | null;
  reason: string;
  details?: string | null;
}

export interface ReportRow {
  id: string;
  reporter_email: string;
  target_type: string;
  target_id: string;
  target_email: string | null;
  reason: string;
  details: string | null;
  status: string;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

/** File a report. Fails quietly to a message rather than throwing. */
export async function submitReport(
  input: ReportInput
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not connected." };

  const { error } = await supabase.from("user_reports").insert({
    reporter_email: input.reporterEmail.toLowerCase(),
    target_type: input.targetType,
    target_id: input.targetId,
    target_email: input.targetEmail?.toLowerCase() ?? null,
    reason: input.reason,
    details: input.details?.trim() || null,
  });

  if (error) {
    return {
      ok: false,
      error: /relation .* does not exist/i.test(error.message)
        ? "Reporting isn't set up yet — run supabase/phase66-safety.sql."
        : error.message,
    };
  }
  return { ok: true };
}

/* ---------------- blocking ---------------- */

export async function blockUser(
  blockerEmail: string,
  blockedEmail: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not connected." };
  const a = blockerEmail.toLowerCase();
  const b = blockedEmail.toLowerCase();
  if (a === b) return { ok: false, error: "You can't block yourself." };

  const { error } = await supabase
    .from("user_blocks")
    .upsert(
      { blocker_email: a, blocked_email: b, reason: reason ?? null },
      { onConflict: "blocker_email,blocked_email" }
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unblockUser(blockerEmail: string, blockedEmail: string) {
  return supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_email", blockerEmail.toLowerCase())
    .eq("blocked_email", blockedEmail.toLowerCase());
}

/** Emails this person has blocked. */
export async function getBlockedEmails(email: string): Promise<string[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_email")
    .eq("blocker_email", email.toLowerCase());
  if (error || !data) return [];
  return data.map((r) => (r as { blocked_email: string }).blocked_email);
}

/**
 * True when either side has blocked the other. Checked before showing a
 * profile, allowing a connection request, or delivering a message — a block
 * has to work in both directions or it isn't a block.
 */
export async function isBlockedEither(
  a: string,
  b: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !a || !b) return false;
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const { data, error } = await supabase
    .from("user_blocks")
    .select("id")
    .or(
      `and(blocker_email.eq.${x},blocked_email.eq.${y}),and(blocker_email.eq.${y},blocked_email.eq.${x})`
    )
    .limit(1);
  if (error || !data) return false;
  return data.length > 0;
}

/* ---------------- admin ---------------- */

export async function getReports(status?: string): Promise<ReportRow[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase
    .from("user_reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as ReportRow[];
}

export async function setReportStatus(
  id: string,
  status: "open" | "reviewing" | "actioned" | "dismissed",
  adminNotes?: string
) {
  return supabase
    .from("user_reports")
    .update({
      status,
      admin_notes: adminNotes ?? null,
      resolved_at:
        status === "actioned" || status === "dismissed"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", id);
}

export function reasonLabel(id: string): string {
  return REPORT_REASONS.find((r) => r.id === id)?.label ?? id;
}
