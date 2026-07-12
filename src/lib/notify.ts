"use client";

/**
 * Lightweight notification helpers (sound + desktop notification) reused
 * outside the booking/chat unread system — e.g. to alert the admin when a new
 * approval or edit request arrives. Mirrors the chat beep so it feels the same.
 */

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Arm audio + ask for notification permission on the first user gesture. */
export function armNotifications() {
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission().catch(() => {});
    }
  } catch {
    /* ignore */
  }
  const onGesture = () => {
    ctx();
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("keydown", onGesture);
  };
  window.addEventListener("pointerdown", onGesture, { once: true });
  window.addEventListener("keydown", onGesture, { once: true });
}

export function playPing() {
  const c = ctx();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    o.type = "sine";
    o.frequency.value = 880;
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.start(t);
    o.stop(t + 0.26);
  } catch {
    /* ignore */
  }
}

export function showDesktopNotification(body: string, title = "Rego") {
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      const n = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "safarigb-admin",
      });
      setTimeout(() => n.close(), 6000);
    }
  } catch {
    /* ignore */
  }
}

/** Convenience: beep + desktop notification together. */
export function notifyPing(body: string, title = "Rego") {
  playPing();
  showDesktopNotification(body, title);
}
