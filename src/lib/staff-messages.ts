import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * The thread between a team member and the Rego admins.
 *
 * One conversation per member. Not a chat system — no channels, no groups,
 * no messages between colleagues. Building the general case first is how the
 * simple case ends up worse.
 *
 * from_admin is not a parameter anywhere in this file. The database checks
 * it: a member's insert policy requires `from_admin is false`, so a message
 * that looks like it came from Rego can only have come from Rego.
 * ============================================================ */

export interface StaffMessage {
  id: string;
  staff_id: string;
  sender_id: string;
  sender_name: string | null;
  from_admin: boolean;
  body: string;
  read_at: string | null;
  created_at: string;
}

const COLUMNS =
  "id, staff_id, sender_id, sender_name, from_admin, body, read_at, created_at";

/** A whole thread, oldest first, the way a conversation reads. */
export async function loadThread(staffId: string): Promise<StaffMessage[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("staff_messages")
    .select(COLUMNS)
    .eq("staff_id", staffId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as unknown as StaffMessage[];
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * Send as the signed-in person.
 *
 * `fromAdmin` decides which side of the thread it sits on, and it is passed
 * because an admin genuinely is writing as Rego — but it is not trusted. A
 * member sending with fromAdmin true is refused by the insert policy, not by
 * this function.
 */
export async function sendMessage(input: {
  staffId: string;
  body: string;
  senderName: string;
  fromAdmin: boolean;
}): Promise<SendResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not configured." };

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write something first." };
  if (body.length > 4000) {
    return { ok: false, error: "That is too long — 4,000 characters at most." };
  }

  /* From the session, not from the caller. sender_id has to equal auth.uid()
     or the policy refuses it, so accepting it as an argument would only
     create a way to get it wrong. */
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return { ok: false, error: "Please sign in again." };

  const { error } = await supabase.from("staff_messages").insert({
    staff_id: input.staffId,
    sender_id: uid,
    sender_name: input.senderName.trim() || null,
    from_admin: input.fromAdmin,
    body,
  });

  if (error) {
    if (/row-level security/i.test(error.message)) {
      return {
        ok: false,
        error: "That is not your thread, or you cannot post as Rego.",
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Mark the other side's messages as read.
 *
 * Only read_at can be written — phase112 revokes the blanket update grant and
 * re-grants that one column, so this cannot become a way to edit what
 * somebody said. Failure is silent: a read receipt that did not save is not
 * worth an error in front of somebody who is reading.
 */
export async function markRead(staffId: string, fromAdmin: boolean): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase
      .from("staff_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("staff_id", staffId)
      .eq("from_admin", fromAdmin)
      .is("read_at", null);
  } catch {
    /* ignore */
  }
}

/** How many messages from the other side are still unopened. */
export async function unreadCount(
  staffId: string,
  fromAdmin: boolean
): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { count, error } = await supabase
    .from("staff_messages")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", staffId)
    .eq("from_admin", fromAdmin)
    .is("read_at", null);
  return error ? 0 : (count ?? 0);
}
