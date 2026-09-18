"use client";

import * as React from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

import { CONSENT_EVENT, getConsent, setConsent } from "@/lib/consent";

/* ============================================================
 * The cookie notice.
 *
 * SHOWS ONCE, AND ONLY WHILE UNDECIDED
 *   Consent lives in a cookie. Once there is an answer — either
 *   answer — this renders nothing, on every page, forever. A
 *   banner that reappears is one people click away without
 *   reading, which makes the recorded consent worth nothing.
 *
 * ---------------------------------------------------------------------------
 * DECLINE IS AS EASY AS ACCEPT
 *
 * Both are real buttons, the same size, side by side, with no
 * pre-ticked boxes and no "manage preferences" maze between the
 * visitor and no. That is the legal standard, and it is also
 * the honest one: a decline button hidden behind two clicks is
 * a design that wants a number more than it wants an answer.
 *
 * Accept is styled as the primary action, which is allowed —
 * the requirement is equal ease, not identical appearance.
 * ---------------------------------------------------------------------------
 *
 * IT DOES NOT BLOCK THE PAGE
 *   No overlay, no modal, no scroll lock. Nothing on Rego is
 *   withheld from someone who has not answered — a traveller
 *   checking whether a road is open should not have to deal
 *   with a cookie dialog first. It sits at the bottom and waits.
 *
 * NOTHING HAS BEEN STORED BY THE TIME THIS RENDERS
 *   Google Analytics and the visit counter are both gated on the
 *   answer, so this is a question asked before anything happens,
 *   not a notice posted after it already has.
 * ============================================================ */

export function CookieBanner() {
  /* Undefined means "not checked yet", which is different from null
     ("checked, and they have not chosen"). Rendering nothing until the
     effect has run keeps the server HTML and the first client render
     identical — reading the cookie during render is a hydration error. */
  const [decided, setDecided] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const sync = () => setDecided(getConsent() !== null);
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (decided === undefined || decided) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-premium-lg backdrop-blur sm:flex-row sm:items-center sm:gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-forest text-gold">
          <Cookie className="h-5 w-5" />
        </span>

        <p className="flex-1 text-sm text-muted-foreground">
          We&rsquo;d like to count visits so we know which parts of Rego are useful. It&rsquo;s a
          random number stored on your device &mdash; no name, no email, nothing shared or sold.
          Rego works exactly the same if you say no.{" "}
          <Link href="/legal/cookies" className="font-semibold text-forest underline">
            Cookie policy
          </Link>
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setConsent("denied")}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-forest hover:bg-muted sm:flex-none"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={() => setConsent("granted")}
            className="flex-1 rounded-lg bg-gradient-gold px-4 py-2 text-sm font-bold text-forest-900 shadow-soft hover:-translate-y-0.5 sm:flex-none"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
