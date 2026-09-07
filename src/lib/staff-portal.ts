"use client";

import * as React from "react";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";

/* ============================================================
 * The signed-in person's own staff record.
 *
 * One RPC, my_staff_profile(), which returns null for anybody who is not an
 * active staff member — including a suspended one. So "am I staff" and "what
 * may I see" are the same question with one answer.
 *
 * ---------------------------------------------------------------------------
 * WHAT `can()` IS AND IS NOT
 *
 * It decides whether to DRAW something. It is not authorisation. The list it
 * reads came over the network and anyone can edit that in a browser, so every
 * action still has to pass staff_can() in an RLS policy or on the server.
 * A hidden button is a courtesy; the database is the rule.
 * ============================================================ */

export interface StaffScope {
  location_id: string;
  name: string;
  location_type: string;
  includes_descendants: boolean;
}

export interface StaffProfile {
  staff_id: string;
  employee_code: string;
  referral_code: string;
  job_title: string | null;
  status: string;
  joined_at: string | null;
  department: { id: string; slug: string; name: string; code_prefix: string };
  role: { id: string; slug: string; name: string };
  permissions: string[];
  scopes: StaffScope[];
}

/* Cached for the tab, not the browser.
   The cache exists for the NAVBAR, which asks on every page render and only
   needs to know "staff or not" to pick a link.

   IT IS NOT SAFE FOR THE PORTAL, and that cost me a real bug: an admin
   granted four blog permissions, and the tab the member already had open
   went on showing the sidebar it had cached before the grant. From their side
   the permission simply had not arrived. sessionStorage survives a reload, so
   "refresh the page" did not help either.

   So the portal loads with `fresh: true` and the cache is only ever a hint
   for the chrome around it. */
const CACHE_KEY = "rego_staff_profile";

function readCache(): StaffProfile | null | undefined {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (raw === null) return undefined; // never asked
    return raw === "none" ? null : (JSON.parse(raw) as StaffProfile);
  } catch {
    return undefined;
  }
}

function writeCache(p: StaffProfile | null): void {
  try {
    window.sessionStorage.setItem(CACHE_KEY, p ? JSON.stringify(p) : "none");
  } catch {
    /* Private browsing. One extra request per page is not worth an error. */
  }
}

/** Forget the cached record — call on sign-out and after an admin change. */
export function clearStaffProfileCache(): void {
  try {
    window.sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export async function loadStaffProfile(
  { fresh = false }: { fresh?: boolean } = {}
): Promise<StaffProfile | null> {
  if (!isSupabaseConfigured) return null;

  if (!fresh) {
    const cached = readCache();
    if (cached !== undefined) return cached;
  }

  const { data, error } = await supabase.rpc("my_staff_profile");
  if (error) {
    /* phase106 has not been run, or the call failed. Not staff, as far as the
       screen is concerned — and deliberately NOT cached, so it starts working
       the moment the migration lands. */
    return null;
  }

  const profile = (data as StaffProfile | null) ?? null;
  writeCache(profile);
  return profile;
}

/** Record that they opened the portal. Failure is not worth reporting. */
export async function touchStaffSeen(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.rpc("touch_staff_seen");
  } catch {
    /* ignore */
  }
}

/**
 * `undefined` while loading, `null` when they are not staff. The three states
 * are kept apart so a screen never flashes "you are not on the team" at
 * somebody who is, during the half second before the answer arrives.
 */
export function useStaffProfile(
  { fresh = false }: { fresh?: boolean } = {}
): StaffProfile | null | undefined {
  const [profile, setProfile] = React.useState<StaffProfile | null | undefined>(
    undefined
  );

  React.useEffect(() => {
    let alive = true;
    loadStaffProfile({ fresh }).then((p) => {
      if (alive) setProfile(p);
    });
    return () => {
      alive = false;
    };
  }, [fresh]);

  return profile;
}

/** Whether to DRAW something. Never whether to allow it. */
export function can(profile: StaffProfile | null | undefined, slug: string): boolean {
  return profile?.permissions.includes(slug) ?? false;
}

/** Their personal referral link, the one attach_referral() resolves. */
export function referralLink(profile: StaffProfile): string {
  return `${siteConfig.url}/partner?ref=${encodeURIComponent(profile.referral_code)}`;
}
