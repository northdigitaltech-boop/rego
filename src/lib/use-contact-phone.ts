"use client";

import * as React from "react";

import { getContactContent } from "@/lib/contact-content";
import { siteConfig } from "@/lib/site";

/* ============================================================
 * The public helpline number, from the SAME source the Contact
 * page uses.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS (I got this wrong once already)
 *
 * The Contact page reads its phone number from the
 * `contact_content` table, which an admin edits in the admin
 * panel. The navbar helpline was hardcoded. An earlier fix
 * pointed the navbar at siteConfig — which looks like one
 * source of truth but is not: siteConfig is only the FALLBACK
 * the Contact page uses before an admin has saved anything.
 *
 * So the moment the number was edited in the admin, the two
 * diverged again. This hook reads the real value.
 * ---------------------------------------------------------------------------
 *
 * Falls back to siteConfig immediately so the navbar never
 * renders blank or flashes a placeholder while loading.
 */

/** Cached per page load — the navbar mounts on every route. */
let cached: { dial: string; display: string } | null = null;

/* The cache above is filled when the request RESOLVES, which is too late
   to stop a second one: the navbar and the footer both mount in the same
   tick, both see `cached` still null, and both ask Supabase for the same
   row. Holding the in-flight promise — not just its answer — makes the
   second caller wait on the first request instead of starting another. */
let inFlight: Promise<void> | null = null;

function spaced(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  // +923161290604 → +92 316 1290604
  const m = digits.match(/^(\+92)(\d{3})(\d{7})$/);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : raw;
}

export function useContactPhone(): { dial: string; display: string } {
  const [phone, setPhone] = React.useState(
    cached ?? {
      dial: siteConfig.contactPhone,
      display: siteConfig.contactPhoneDisplay,
    }
  );

  React.useEffect(() => {
    if (cached) return;
    let alive = true;

    inFlight ??= getContactContent()
      .then((c) => {
        if (!c.phone) return;
        cached = { dial: c.phone.replace(/\s+/g, ""), display: spaced(c.phone) };
      })
      /* A failed read keeps the siteConfig fallback. A helpline that
         disappears is worse than one that is briefly out of date.
         Clearing inFlight lets a later mount try again. */
      .catch(() => {
        inFlight = null;
      });

    inFlight.then(() => {
      if (alive && cached) setPhone(cached);
    });

    return () => {
      alive = false;
    };
  }, []);

  return phone;
}
