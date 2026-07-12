"use client";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Lightweight, privacy-respecting visit/action tracking. Events are logged
 * anonymously (a random per-device visitor id in localStorage). We never store
 * customer name / phone / email in an event — only an optional signed-in
 * user_email for unique/repeat counting, which the CRM shows as numbers only.
 */

export type EventType =
  | "profile_view"
  | "listing_view"
  | "whatsapp_click"
  | "phone_click"
  | "message_click"
  | "booking_request_click"
  | "wishlist_save"
  | "wishlist_remove"
  | "map_click"
  | "review_click"
  | "share_click";

const VISITOR_KEY = "safarigb_visitor_id";

export function visitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function deviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua) || (/(android)/.test(ua) && !/mobile/.test(ua)))
    return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(ua)) return "mobile";
  return "desktop";
}

export interface TrackInput {
  ownerEmail?: string | null;
  listingId?: string | null;
  serviceType?: string | null;
  eventType: EventType;
  userEmail?: string | null;
}

/** Fire-and-forget: never throws, never blocks the UI. */
export async function trackEvent(input: TrackInput): Promise<void> {
  if (!isSupabaseConfigured || typeof window === "undefined") return;
  try {
    await supabase.from("listing_analytics_events").insert({
      owner_email: input.ownerEmail ?? null,
      listing_id: input.listingId ?? null,
      service_type: input.serviceType ?? null,
      event_type: input.eventType,
      visitor_id: visitorId(),
      user_email: input.userEmail ?? null,
      device_type: deviceType(),
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    });
  } catch {
    /* analytics must never break the page */
  }
}

/** De-dupes a view per listing per session so a refresh isn't double-counted. */
export function trackViewOnce(input: TrackInput & { eventType: "listing_view" | "profile_view" }) {
  if (typeof window === "undefined" || !input.listingId) return;
  const key = `sgb_view_${input.eventType}_${input.listingId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
  void trackEvent(input);
}
