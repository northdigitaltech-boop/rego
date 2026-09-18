"use client";

import * as React from "react";

/* ============================================================
 * Whether this visitor has agreed to being counted.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL
 *
 * Rego stores a random id in the browser so it can tell a
 * first-time visitor from someone coming back. That id is not a
 * name, an email or an address — but it is an identifier stored
 * on someone's device for analytics, and under GDPR and the UK
 * PECR that needs permission first, not a notice afterwards.
 *
 * So nothing is stored and nothing is sent until the visitor
 * says yes. Decline and no id is ever created — not a disabled
 * one, not an anonymised one. There is simply nothing.
 * ---------------------------------------------------------------------------
 *
 * WHY A COOKIE AND NOT localStorage, WHEN THE VISITOR ID USES
 * localStorage
 *   The answer travels with the request. A cookie can be read by
 *   the server, by middleware and by an edge function, so the
 *   decision can be honoured anywhere later without shipping
 *   JavaScript first. localStorage is only ever visible to a
 *   script that has already run — which is too late to decide
 *   whether that script should run.
 *
 * WHY THERE IS NO DEFAULT
 *   getConsent() returns null until the visitor chooses. Not
 *   "denied", which would be indistinguishable from someone who
 *   actively refused, and not "granted", which would be helping
 *   itself. Null is what makes the banner appear exactly once.
 * ============================================================ */

export type Consent = "granted" | "denied";

const COOKIE = "rego_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Fired on the window whenever the choice changes, so listeners react without a reload. */
export const CONSENT_EVENT = "rego:consent";

export function getConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE}=(granted|denied)(?:;|$)`)
  );
  return (match?.[1] as Consent | undefined) ?? null;
}

export function setConsent(value: Consent): void {
  if (typeof document === "undefined") return;
  /* Lax, not None: this cookie is never needed on a cross-site request, and
     None would require Secure everywhere and hand it to every embedded
     third party. Secure is added only on https so local development over
     http still works. */
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${value}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax${secure}`;

  if (value === "denied") clearAnalyticsStorage();
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

/**
 * Forget the choice, so the banner asks again.
 *
 * Withdrawing has to be as easy as agreeing — that is the rule, not a
 * courtesy — which is why the footer carries a link that calls this.
 */
export function resetConsent(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  clearAnalyticsStorage();
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
}

/**
 * Remove everything the analytics side put on the device.
 *
 * Declining after having accepted must actually take the id away, or the
 * next "yes" silently resumes an identity the visitor asked to end. Wiped
 * on decline and on reset, both.
 */
function clearAnalyticsStorage(): void {
  try {
    localStorage.removeItem("safarigb_visitor_id");
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("rego_visit_") || k.startsWith("_ga")) localStorage.removeItem(k);
    }
  } catch {
    /* Storage disabled or full — nothing to clear. */
  }
}

/** Reactive consent state. Null while undecided, and during server render. */
export function useConsent(): Consent | null {
  /* Starts null on both server and client so the first client render matches
     the HTML. Reading the cookie during render would make them disagree, and
     React would throw a hydration error on every page. */
  const [consent, setState] = React.useState<Consent | null>(null);

  React.useEffect(() => {
    setState(getConsent());
    const onChange = (e: Event) =>
      setState(((e as CustomEvent).detail as Consent | null) ?? null);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  return consent;
}

/** True only once the visitor has actively said yes. */
export function analyticsAllowed(): boolean {
  return getConsent() === "granted";
}
