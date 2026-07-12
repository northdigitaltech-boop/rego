import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";
import { sendEmail } from "@/lib/email";

export interface ReviewRow {
  id: string;
  hotel_id: string;
  customer_email: string;
  customer_name: string | null;
  customer_avatar: string | null;
  rating: number;
  text: string | null;
  owner_reply: string | null;
  owner_reply_at: string | null;
  created_at: string;
}

export async function getReviews(hotelId: string): Promise<ReviewRow[]> {
  if (!isSupabaseConfigured || !isUuid(hotelId)) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getReviews error:", error.message);
    return [];
  }
  return (data as ReviewRow[]) ?? [];
}

export async function addReview(input: {
  hotel_id: string;
  customer_email: string;
  customer_name: string | null;
  customer_avatar: string | null;
  rating: number;
  text: string | null;
  owner_email?: string | null;
}) {
  return supabase.from("reviews").insert(input);
}

/** Owner posts / edits a public reply to a review. */
export async function replyToReview(id: string, reply: string) {
  return supabase
    .from("reviews")
    .update({
      owner_reply: reply.trim() || null,
      owner_reply_at: reply.trim() ? new Date().toISOString() : null,
    })
    .eq("id", id);
}

/**
 * Emails the service provider when a customer posts a review, so they're
 * alerted for attention. Best-effort and non-blocking — a missing owner email
 * or a mail failure never blocks the review itself. Shared by every module
 * (hotels, homestays, tours, transport, guides, media, restaurants, roadside).
 */
export async function notifyProviderOfReview(opts: {
  ownerEmail?: string | null;
  providerName?: string | null;
  reviewerName?: string | null;
  rating: number;
  text?: string | null;
  url?: string | null;
}): Promise<void> {
  const to = (opts.ownerEmail ?? "").trim();
  if (!to) return;
  const rating = Math.max(1, Math.min(5, Math.round(opts.rating || 0)));
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const forName = opts.providerName ? ` for <strong>${opts.providerName}</strong>` : "";
  const link = opts.url
    ? `<p><a href="${opts.url}">View the review on Rego</a></p>`
    : "";
  const body =
    `<p>You have a new customer review${forName}.</p>` +
    `<p><strong>${opts.reviewerName || "A customer"}</strong> rated you <strong>${rating}/5</strong> (${stars}).</p>` +
    (opts.text ? `<blockquote style="margin:8px 0;padding:8px 12px;border-left:3px solid #d4a017;color:#444">${opts.text}</blockquote>` : "") +
    link +
    `<p>Log in to your Rego dashboard to see it and keep your rating strong.</p>`;
  try {
    await sendEmail(to, `New ${rating}★ review${opts.providerName ? ` — ${opts.providerName}` : ""} on Rego`, body);
  } catch {
    /* non-blocking */
  }
}
