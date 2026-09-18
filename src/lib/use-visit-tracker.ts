"use client";

import * as React from "react";

import { CONSENT_EVENT, getConsent } from "@/lib/consent";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { visitorId } from "@/lib/track";

/* ============================================================
 * Tells the database this browser showed up today.
 *
 * ONCE A DAY, NOT ONCE A PAGE
 *   The question being answered is "how many people came, and
 *   how many had been before" — a person who reads nine pages is
 *   one visitor, not nine. Recording per page would need a write
 *   on every navigation to produce the same answer, so a local
 *   marker for today's date short-circuits the rest of the day.
 *
 *   The database call is idempotent anyway (record_site_visit
 *   upserts), so the marker is a courtesy to the network, not a
 *   correctness requirement. Cleared storage costs one extra
 *   write and changes no number.
 *
 * NOTHING HAPPENS WITHOUT CONSENT
 *   No id is generated, no request is made, nothing is written
 *   to the device. visitorId() is only ever called after the
 *   check, because calling it is itself the act of storing an
 *   identifier.
 *
 * IT LISTENS FOR THE ANSWER
 *   Someone who accepts the banner is counted immediately rather
 *   than on their next page. Without that, every first session
 *   would be invisible and "new visitors" would systematically
 *   under-report the people most worth knowing about.
 *
 * FAILS SILENT
 *   Offline, blocked, RLS refusing — a visitor counter must
 *   never surface anything to the person being counted.
 * ============================================================ */

const DAY_KEY_PREFIX = "rego_visit_";

/** Local calendar date, matching the Asia/Karachi date the function stores. */
function todayKey(): string {
  const d = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
  return `${DAY_KEY_PREFIX}${d}`;
}

async function recordOncePerDay(): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (getConsent() !== "granted") return;

  const key = todayKey();
  try {
    if (localStorage.getItem(key)) return;
  } catch {
    /* Storage unavailable — fall through and just record it. */
  }

  const id = visitorId();
  if (!id) return;

  try {
    const { error } = await supabase.rpc("record_site_visit", { p_visitor_id: id });
    /* Only mark the day done if the write actually landed. Marking it
       optimistically would lose the visit whenever the first request of the
       day failed, and undercount exactly the people on bad connections. */
    if (!error) localStorage.setItem(key, "1");
  } catch {
    /* Never surfaced. */
  }
}

export function useVisitTracker(): void {
  React.useEffect(() => {
    void recordOncePerDay();

    const onConsent = () => void recordOncePerDay();
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);
}
