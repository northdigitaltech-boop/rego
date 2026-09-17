"use client";

import * as React from "react";

import { armNotifications, notifyPing } from "@/lib/notify";
import { loadPendingApprovals } from "@/lib/approvals";

/* ============================================================
 * Tells a reviewer when something arrives for them.
 *
 * Polls the approvals queue and pings — sound plus a desktop
 * notification — when the count goes UP. The count itself is
 * returned so the sidebar can carry a badge.
 *
 * WHY IT PINGS ON A RISE, NOT ON A NON-ZERO COUNT
 *   Five things waiting when you open the portal is not news; it
 *   is the backlog you already knew about. A sixth arriving while
 *   you are sitting there is. Alerting on "greater than zero"
 *   would mean a chime on every page load until the queue is
 *   empty, and an alert that fires when nothing happened is one
 *   people learn to ignore.
 *
 * THE FIRST READING IS NEVER AN ALERT
 *   prev starts null, so the opening count only establishes the
 *   baseline. Without that, opening the portal to an existing
 *   backlog would announce it as new.
 *
 * ONLY WHILE THE TAB IS VISIBLE
 *   A background tab polling every 45 seconds for hours costs a
 *   phone battery for no benefit — nobody is going to act on it
 *   until they come back. It catches up on return.
 *
 * WHAT IT DOES NOT DO
 *   It does not decide who may see what. loadPendingApprovals
 *   returns what phase111's policies allow this person to read,
 *   scoped to their areas. Someone without approval permissions
 *   gets an empty list from Postgres and therefore silence.
 * ============================================================ */

const POLL_MS = 45_000;

export function useApprovalAlerts(enabled: boolean): number {
  const [count, setCount] = React.useState(0);
  const prev = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!enabled) return;

    /* Browsers refuse both sound and notification permission until the
       person has interacted with the page. This waits for the first click
       or keypress, then arms both. */
    armNotifications();

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      try {
        const rows = await loadPendingApprovals();
        if (stopped) return;

        const n = rows.length;
        setCount(n);

        const before = prev.current;
        prev.current = n;

        if (before === null) return; // first reading — baseline only
        if (n <= before) return; // handled, or unchanged

        const added = n - before;
        notifyPing(
          added === 1
            ? "A new listing is waiting for your review."
            : `${added} new listings are waiting for your review.`,
          "Rego — approvals"
        );
      } catch {
        /* Offline, or no permission. Silence is right: an alert system that
           announces its own failures is worse than one that stays quiet. */
      }
    };

    void check();

    const start = () => {
      if (timer || stopped) return;
      timer = setInterval(() => void check(), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void check();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return count;
}
