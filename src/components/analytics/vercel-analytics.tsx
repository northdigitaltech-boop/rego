"use client";

import { Analytics } from "@vercel/analytics/next";

import { useConsent } from "@/lib/consent";

/* ============================================================
 * Vercel Web Analytics, behind the same answer as Google's.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS GATED WHEN IT DOES NOT SET COOKIES
 *
 * Vercel Web Analytics is cookieless — it stores nothing on the
 * visitor's device, so a cookie banner does not strictly have to cover
 * it, and plenty of sites run it ungated.
 *
 * Rego's banner says something more specific than "we use cookies":
 *
 *     "no name, no email, nothing shared or sold.
 *      Rego works exactly the same if you say no."
 *
 * Page views, referrer, country and device leaving for a third party
 * after somebody pressed No is hard to square with that sentence. The
 * promise on the banner is the one that has to hold, not the minimum
 * the regulation would accept — so this loads only after a yes.
 *
 * The cost is real and worth naming: the numbers in the Vercel
 * dashboard will undercount by however many people decline. They are
 * still a fair sample for comparing pages against each other, which is
 * what the dashboard is for.
 *
 * ---------------------------------------------------------------------------
 * SPEED INSIGHTS IS NOT GATED, AND THAT IS A SEPARATE DECISION
 *
 * <SpeedInsights /> in the root layout runs for everyone. It measures
 * how fast the page was for a real device rather than what the visitor
 * did, which is a different kind of collection. Left as it is rather
 * than changed quietly here — but if the banner's promise should cover
 * it too, the same wrapper works for it.
 * ============================================================ */
export function VercelAnalytics() {
  const consent = useConsent();
  /* Nothing rendered, so no script, so nothing sent. Same shape as
     GoogleAnalytics: useConsent() subscribes rather than reading once, so
     accepting starts it on the next render with no reload. */
  if (consent !== "granted") return null;
  return <Analytics />;
}
