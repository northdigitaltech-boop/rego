import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";

export interface MessageRow {
  id: string;
  booking_id: string;
  sender_email: string;
  sender_name: string | null;
  sender_avatar: string | null;
  text: string;
  created_at: string;
}

export async function getMessages(bookingId: string): Promise<MessageRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getMessages error:", error.message);
    return [];
  }
  return (data as MessageRow[]) ?? [];
}

export async function sendMessage(input: {
  booking_id: string;
  sender_email: string;
  sender_name: string;
  sender_avatar?: string | null;
  text: string;
}) {
  return supabase.from("messages").insert(input);
}

/**
 * Drops an initial "new booking request" message into the booking thread so the
 * owner gets an instant unread alert (sound + notification + navbar badge) that
 * carries the booking reference. Sent as the customer, so it's unread for the
 * owner but not for the customer.
 */
export async function sendBookingNotification(opts: {
  booking_id: string;
  customer_email: string;
  customer_name: string;
  customer_avatar?: string | null;
  ref: string;
  summary: string;
}) {
  return sendMessage({
    booking_id: opts.booking_id,
    sender_email: opts.customer_email,
    sender_name: opts.customer_name,
    sender_avatar: opts.customer_avatar ?? null,
    text: `New booking request ${opts.ref} — ${opts.summary}. Please review and accept or reject.`,
  });
}

/**
 * Drops a status update into the booking thread when the owner accepts /
 * rejects / completes a request, so the customer gets an instant alert
 * (sound + notification + navbar badge) carrying the booking reference.
 * Sent as the owner, so it's unread for the customer.
 */
export async function sendBookingStatusNotification(opts: {
  booking_id: string;
  owner_email: string;
  owner_name: string;
  owner_avatar?: string | null;
  ref: string;
  itemTitle: string;
  status: "accepted" | "rejected" | "completed";
}) {
  const msg =
    opts.status === "accepted"
      ? `Good news! Your booking ${opts.ref} for ${opts.itemTitle} has been ACCEPTED. We'll follow up with the details.`
      : opts.status === "completed"
        ? `Your booking ${opts.ref} for ${opts.itemTitle} is marked COMPLETED. Thank you — please leave a review!`
        : `Update on your booking ${opts.ref} for ${opts.itemTitle}: it could not be confirmed this time. Please try different dates or another option.`;
  return sendMessage({
    booking_id: opts.booking_id,
    sender_email: opts.owner_email,
    sender_name: opts.owner_name,
    sender_avatar: opts.owner_avatar ?? null,
    text: msg,
  });
}

/**
 * Drops a payment-status update into the booking thread when the owner/admin
 * verifies a payment, so the customer gets an instant alert (sound + badge)
 * confirming receipt and the amount.
 */
export async function sendPaymentNotification(opts: {
  booking_id: string;
  owner_email: string;
  owner_name: string;
  owner_avatar?: string | null;
  ref: string;
  amount: number;
  status: "paid" | "partially_paid" | "rejected" | "refunded";
}) {
  const amt = opts.amount > 0 ? formatPrice(opts.amount) : "";
  const msg =
    opts.status === "paid"
      ? `Your payment${amt ? ` of ${amt}` : ""} for booking ${opts.ref} has been received and verified. Thank you! ✅`
      : opts.status === "partially_paid"
        ? `We've received your partial payment${amt ? ` of ${amt}` : ""} for booking ${opts.ref}. The remaining balance is payable as agreed.`
        : opts.status === "refunded"
          ? `A refund${amt ? ` of ${amt}` : ""} has been issued for booking ${opts.ref}.`
          : `Your submitted payment for booking ${opts.ref} could not be verified. Please check the details and submit your proof again.`;
  return sendMessage({
    booking_id: opts.booking_id,
    sender_email: opts.owner_email,
    sender_name: opts.owner_name,
    sender_avatar: opts.owner_avatar ?? null,
    text: msg,
  });
}

export interface MsgMeta {
  booking_id: string;
  sender_email: string;
  sender_name: string | null;
  text: string | null;
  created_at: string;
}

/* ============================================================
 * Admin ↔ owner direct messaging
 * The shared messages.booking_id column is a UUID, so the admin↔owner thread id
 * is a *deterministic* UUID derived from the owner's email (no migration
 * needed). Same email always yields the same thread.
 * ============================================================ */

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/** Stable UUID for an owner's admin support thread. */
export function adminThreadId(ownerEmail: string): string {
  const [a, b, c, d] = cyrb128("safarigb-admin::" + ownerEmail.trim().toLowerCase());
  const hx = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  const h = hx(a) + hx(b) + hx(c) + hx(d); // 32 hex chars
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export interface AdminThread {
  threadId: string;
  ownerEmail: string;
  lastText: string | null;
  lastAt: string;
}

/**
 * Admin inbox: every admin↔owner thread that has messages. Threads are
 * discovered two ways so nothing is missed:
 *  1. from the supplied owner emails (the admin's listings), and
 *  2. directly from the messages — a message whose sender is the owner of its
 *     own thread satisfies adminThreadId(sender_email) === booking_id.
 */
export async function getAdminThreads(
  ownerEmails: string[] = []
): Promise<AdminThread[]> {
  if (!isSupabaseConfigured) return [];
  const idToEmail = new Map<string, string>();
  for (const raw of ownerEmails) {
    const e = (raw ?? "").trim().toLowerCase();
    if (e) idToEmail.set(adminThreadId(e), e);
  }

  const { data, error } = await supabase
    .from("messages")
    .select("booking_id, sender_email, text, created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const rows = data as {
    booking_id: string;
    sender_email: string;
    text: string;
    created_at: string;
  }[];

  // Discover owner emails from the messages themselves.
  for (const m of rows) {
    const e = (m.sender_email ?? "").trim().toLowerCase();
    if (e && adminThreadId(e) === m.booking_id) idToEmail.set(m.booking_id, e);
  }

  // Latest message per admin thread (rows are newest-first).
  const seen = new Map<string, AdminThread>();
  for (const m of rows) {
    if (!idToEmail.has(m.booking_id) || seen.has(m.booking_id)) continue;
    seen.set(m.booking_id, {
      threadId: m.booking_id,
      ownerEmail: idToEmail.get(m.booking_id) as string,
      lastText: m.text,
      lastAt: m.created_at,
    });
  }
  return Array.from(seen.values());
}

/** Lightweight message activity across many bookings (badges + previews). */
export async function getMessagesForBookings(
  ids: string[]
): Promise<MsgMeta[]> {
  if (!isSupabaseConfigured || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("booking_id, sender_email, sender_name, text, created_at")
    .in("booking_id", ids);
  if (error) {
    console.error("getMessagesForBookings error:", error.message);
    return [];
  }
  return (data as MsgMeta[]) ?? [];
}
