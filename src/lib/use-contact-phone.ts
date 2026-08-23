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
    getContactContent()
      .then((c) => {
        if (!alive || !c.phone) return;
        const next = { dial: c.phone.replace(/\s+/g, ""), display: spaced(c.phone) };
        cached = next;
        setPhone(next);
      })
      /* A failed read keeps the siteConfig fallback. A helpline that
         disappears is worse than one that is briefly out of date. */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return phone;
}
