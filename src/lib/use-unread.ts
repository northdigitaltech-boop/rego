"use client";

import * as React from "react";

import { getMessagesForBookings } from "@/lib/messages";
import { subscribeToMessages } from "@/lib/realtime";
import { usePoll } from "@/lib/use-poll";

function seenKey(email: string, bookingId: string) {
  return `safarigb_seen_${email}_${bookingId}`;
}

function getSeen(email: string, id: string): number {
  try {
    const v = localStorage.getItem(seenKey(email, id));
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function setSeen(email: string, id: string, time: number) {
  try {
    localStorage.setItem(seenKey(email, id), String(time));
  } catch {
    /* ignore */
  }
}

let permissionRequested = false;
function ensureNotificationPermission() {
  if (permissionRequested) return;
  permissionRequested = true;
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission().catch(() => {});
    }
  } catch {
    /* notifications not available */
  }
}

function showNotification(count: number) {
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      const n = new Notification("Rego", {
        body:
          count > 1
            ? `You have ${count} new messages`
            : "You have a new message",
        icon: "/favicon.ico",
        tag: "safarigb-chat",
      });
      setTimeout(() => n.close(), 6000);
    }
  } catch {
    /* ignore */
  }
}

let audioCtx: AudioContext | null = null;
function playBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.start(t);
    o.stop(t + 0.26);
  } catch {
    /* audio not available */
  }
}

// Browsers block audio until the user interacts with the page. Create/resume
// the AudioContext on the first gesture so later beeps actually play.
function unlockAudio() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    /* ignore */
  }
}

/**
 * Polls message activity for the given bookings and returns which ones have
 * unread messages (from the other party, newer than last seen). Plays a sound
 * when a new unread message appears.
 */
export function useUnread(
  bookingIds: string[],
  email: string,
  options?: { sound?: boolean }
) {
  const sound = options?.sound ?? true;
  const [unread, setUnread] = React.useState<Set<string>>(new Set());
  const prevIds = React.useRef<Set<string>>(new Set());
  const firstRun = React.useRef(true);
  const idsKey = bookingIds.join(",");

  React.useEffect(() => {
    ensureNotificationPermission();
    const onGesture = () => unlockAudio();
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  const refresh = React.useCallback(async () => {
    if (!email || !idsKey) {
      setUnread(new Set());
      return;
    }
    const ids = idsKey.split(",");
    const msgs = await getMessagesForBookings(ids);
    const next = new Set<string>();
    for (const id of ids) {
      const seen = getSeen(email, id);
      const hasUnread = msgs.some(
        (m) =>
          m.booking_id === id &&
          m.sender_email !== email &&
          new Date(m.created_at).getTime() > seen
      );
      if (hasUnread) next.add(id);
    }
    // Conversations that just became unread (a new message arrived).
    const newOnes = [...next].filter((id) => !prevIds.current.has(id));
    setUnread(next);
    if (!firstRun.current && newOnes.length > 0) {
      if (sound) playBeep();
      showNotification(newOnes.length);
    }
    firstRun.current = false;
    prevIds.current = next;
  }, [idsKey, email, sound]);

  // Initial load, then a slow safety-net poll that pauses when the tab is
  // hidden. Most updates arrive instantly via Realtime below, so this only
  // needs to catch anything the websocket missed.
  React.useEffect(() => {
    refresh();
  }, [refresh]);
  usePoll(refresh, 30000);

  // Realtime: react to new messages immediately without hammering the DB.
  React.useEffect(() => {
    if (!email || !idsKey) return;
    const ids = new Set(idsKey.split(","));
    const unsub = subscribeToMessages((m) => {
      if (!ids.has(m.booking_id) || m.sender_email === email) return;
      if (new Date(m.created_at).getTime() <= getSeen(email, m.booking_id)) return;
      const wasUnread = prevIds.current.has(m.booking_id);
      const next = new Set(prevIds.current);
      next.add(m.booking_id);
      prevIds.current = next;
      setUnread(new Set(next));
      if (!wasUnread) {
        if (sound) playBeep();
        showNotification(1);
      }
    });
    return unsub;
  }, [idsKey, email, sound]);

  const markSeen = React.useCallback(
    (id: string) => {
      setSeen(email, id, Date.now());
      setUnread((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      const p = new Set(prevIds.current);
      p.delete(id);
      prevIds.current = p;
    },
    [email]
  );

  return { unread, markSeen };
}
