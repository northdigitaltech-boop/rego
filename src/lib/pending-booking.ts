"use client";

import * as React from "react";

/* ============================================================
 * Holding a booking across sign-up.
 *
 * A visitor who is not signed in used to fill the whole booking
 * form, press the button, and land on the sign-in page with
 * every field thrown away. After creating an account they came
 * back to an empty form and had to type it all again. Most
 * people don't.
 *
 * So the form is snapshotted here first, and replayed once they
 * are back and signed in.
 *
 * WHY sessionStorage AND NOT localStorage.
 * This is an intent, not a preference. It belongs to one tab and
 * one sitting. localStorage would keep a half-finished booking
 * alive for weeks and fire it on some unrelated future visit.
 *
 * TWO THINGS STOP A BOOKING BEING MADE BY ACCIDENT:
 *  - it expires (see MAX_AGE_MS)
 *  - reading it removes it (see takePendingBooking)
 * The second matters most: bookings here are confirmed the
 * moment they are created, so a replay that could run twice
 * would mean two real bookings from one form.
 * ============================================================ */

const KEY = "rego:pending-booking";

/**
 * An hour is long enough to create an account, verify an email and come back;
 * short enough that a booking abandoned before lunch cannot fire after it.
 */
const MAX_AGE_MS = 60 * 60 * 1000;

export interface PendingBooking {
  /** Which kind of listing — a media form must never replay into a hotel. */
  kind: string;
  /** Which listing exactly. */
  listingId: string;
  savedAt: number;
  form: Record<string, unknown>;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    /* Private mode and locked-down browsers throw on access. Losing the
       snapshot is a nuisance; a crashed booking form is not acceptable. */
    return null;
  }
}

export function savePendingBooking(
  kind: string,
  listingId: string,
  form: Record<string, unknown>
): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify({ kind, listingId, savedAt: Date.now(), form }));
  } catch {
    /* Quota or serialisation failure — the visitor simply retypes. */
  }
}

export function clearPendingBooking(): void {
  const s = storage();
  try {
    s?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Read the snapshot for this listing AND remove it, in one step.
 *
 * Read-and-remove, not read: it can only ever be replayed once. A refresh, a
 * re-mount or a second effect run finds nothing, so one filled form cannot
 * become two bookings.
 *
 * Returns null unless the snapshot is for this exact listing and still fresh.
 */
export function takePendingBooking(
  kind: string,
  listingId: string
): Record<string, unknown> | null {
  const s = storage();
  if (!s) return null;

  let raw: string | null = null;
  try {
    raw = s.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: PendingBooking | null = null;
  try {
    parsed = JSON.parse(raw) as PendingBooking;
  } catch {
    clearPendingBooking();
    return null;
  }

  /* Anything that is not this listing's fresh snapshot is dropped rather than
     left lying around — including a stale one, which is the whole point. */
  if (
    !parsed ||
    parsed.kind !== kind ||
    parsed.listingId !== listingId ||
    typeof parsed.savedAt !== "number" ||
    Date.now() - parsed.savedAt > MAX_AGE_MS
  ) {
    if (parsed && Date.now() - (parsed.savedAt ?? 0) > MAX_AGE_MS) {
      clearPendingBooking();
    }
    return null;
  }

  clearPendingBooking();
  return parsed.form ?? null;
}

/** Where to send someone who has to make an account before booking. */
export function signupHref(returnTo: string): string {
  return `/signup?redirect=${encodeURIComponent(returnTo)}`;
}

/* ------------------------------------------------------------------ */
/* Replay                                                              */
/* ------------------------------------------------------------------ */

/**
 * Replays a held booking once the visitor is signed in.
 *
 * Restore and submit are deliberately two renders apart. `restore` calls
 * setState; those values are not readable until React has re-rendered, so
 * submitting in the same pass would send the empty form that was already
 * there. The flag makes the second effect run after the restored values are
 * on screen, which is also what the visitor sees.
 */
export function useResumeBooking(opts: {
  kind: string;
  listingId: string;
  ready: boolean;
  restore: (form: Record<string, unknown>) => void;
  submit: () => void;
}): boolean {
  const { kind, listingId, ready, restore, submit } = opts;
  const [replaying, setReplaying] = React.useState(false);
  const done = React.useRef(false);

  /* Kept in refs so a re-render does not re-run the effects — restore and
     submit are new function identities on every render. */
  const restoreRef = React.useRef(restore);
  const submitRef = React.useRef(submit);
  restoreRef.current = restore;
  submitRef.current = submit;

  React.useEffect(() => {
    if (!ready || done.current) return;
    const form = takePendingBooking(kind, listingId);
    if (!form) return;
    done.current = true;
    restoreRef.current(form);
    setReplaying(true);
  }, [ready, kind, listingId]);

  React.useEffect(() => {
    if (!replaying) return;
    setReplaying(false);
    submitRef.current();
  }, [replaying]);

  return replaying;
}

/* ------------------------------------------------------------------ */
/* Reading a snapshot back                                             */
/* ------------------------------------------------------------------ */

export const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

export const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export const bool = (v: unknown, fallback = false): boolean =>
  typeof v === "boolean" ? v : fallback;
