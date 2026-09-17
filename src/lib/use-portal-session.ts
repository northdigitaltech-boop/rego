"use client";

import * as React from "react";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Records that the portal is open.
 *
 * Calls touch_staff_session() once on mount and then about every
 * 60 seconds. That function decides everything — whether this is
 * a new visit or a continuation, and how long it has run. The
 * browser sends no numbers at all, so a client cannot invent a
 * hundred visits or an eight-hour session.
 *
 * ONLY WHILE THE TAB IS VISIBLE.
 *   A background tab left open for three days would otherwise
 *   report three days in the portal. The beat stops on
 *   visibilitychange and resumes when they come back, so the
 *   number means "had this open in front of them", which is the
 *   only version of it worth reading.
 *
 * Fails silent. If the call errors — offline, suspended account,
 * migration not run — nothing is shown and nothing is retried
 * aggressively. Analytics must never be the reason a working
 * portal appears broken.
 * ============================================================ */

const BEAT_MS = 60_000;

export function usePortalSession(enabled = true): void {
  React.useEffect(() => {
    if (!enabled || !isSupabaseConfigured) return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = async () => {
      /* Hidden tab: skip. The 30-minute window in the SQL means a short
         absence continues the same session rather than starting a new one. */
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      try {
        await supabase.rpc("touch_staff_session");
      } catch {
        /* Not staff, offline, or phase121 not applied. Silence is correct —
           there is nothing the person reading this screen could do about it. */
      }
    };

    void beat();

    const start = () => {
      if (timer || stopped) return;
      timer = setInterval(() => void beat(), BEAT_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        /* Beat immediately on return, so the gap does not have to wait out a
           full interval before the session looks alive again. */
        void beat();
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
}
