"use client";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { MessageRow } from "@/lib/messages";

/**
 * Subscribes to new rows in the `messages` table via Supabase Realtime
 * (websockets) instead of polling. `onInsert` fires once per new message.
 *
 * Requires the table to be in the realtime publication:
 *   alter publication supabase_realtime add table public.messages;
 * (see supabase/phase25-realtime.sql). If realtime isn't enabled the callback
 * simply never fires and callers fall back to their slow polling timer.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(
  onInsert: (m: MessageRow) => void
): () => void {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel(`messages-stream-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const row = payload.new as MessageRow | undefined;
        if (row) onInsert(row);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/* ============================================================
 * Roadside live-location tracking (Realtime "broadcast")
 * Position ticks are sent over an ephemeral channel keyed by request id —
 * no per-tick database write. The provider persists their last position to
 * the request row separately (throttled) for late joiners / reconnects.
 * ============================================================ */

export interface TrackingPing {
  lat: number;
  lng: number;
  at: number; // epoch ms
}

function trackChannelName(requestId: string) {
  return `roadside-track-${requestId}`;
}

/** Customer side: listen for the provider's live position. */
export function subscribeToTracking(
  requestId: string,
  onPing: (p: TrackingPing) => void
): () => void {
  if (!isSupabaseConfigured || !requestId) return () => {};
  const channel = supabase
    .channel(trackChannelName(requestId), { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "loc" }, (msg) => {
      const p = msg.payload as TrackingPing | undefined;
      if (p && typeof p.lat === "number" && typeof p.lng === "number") onPing(p);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Provider side: get a sender for pushing live position ticks. */
export function createTrackingSender(requestId: string): {
  send: (p: TrackingPing) => void;
  close: () => void;
} {
  if (!isSupabaseConfigured || !requestId) {
    return { send: () => {}, close: () => {} };
  }
  const channel = supabase.channel(trackChannelName(requestId));
  channel.subscribe();
  return {
    send: (p: TrackingPing) => {
      void channel.send({ type: "broadcast", event: "loc", payload: p });
    },
    close: () => {
      void supabase.removeChannel(channel);
    },
  };
}
