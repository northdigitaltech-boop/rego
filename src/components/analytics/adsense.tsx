"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

import { useConsent } from "@/lib/consent";
import { IS_INDEXABLE } from "@/lib/site";

/* ============================================================
 * Google AdSense.
 *
 * ---------------------------------------------------------------------------
 * THIS ONE IS NOT LIKE THE OTHER TWO SCRIPTS
 *
 * GoogleAnalytics and VercelAnalytics measure. AdSense sells: it
 * reads the page, sets advertising cookies, and passes what it
 * learns to Google's ad network and, for personalised ads, to the
 * buyers bidding on the impression.
 *
 * That is why the cookie banner's wording had to change alongside
 * this file. It used to say "nothing shared or sold", which would
 * simply have stopped being true the moment a visitor pressed
 * Allow. Gating the script is necessary but not sufficient — a
 * consent that was collected under a sentence that no longer
 * describes what happens is not consent to this.
 *
 * ---------------------------------------------------------------------------
 * PRODUCTION DOMAIN ONLY, AND THAT IS NOT A STYLE PREFERENCE
 *
 * AdSense counts an impression wherever the script runs. On
 * localhost and Vercel preview URLs the only visitor is you, and
 * repeatedly loading your own ads is what Google's policies call
 * invalid traffic. Accounts are suspended for it, usually without
 * warning and often permanently.
 *
 * IS_INDEXABLE is reused rather than a new flag: it already means
 * "a production build served from rego.services", which is exactly
 * the condition wanted here. If that ever stops being the right
 * test for ads, split it — do not loosen it.
 * ============================================================ */

/** Publisher ID. Public by definition — it is in the script URL on every page. */
const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-3629088780949329";

/* ---------------------------------------------------------------------------
 * ROUTES THE SCRIPT NEVER LOADS ON
 *
 * Auto Ads places ads on any page carrying the script, and these are the
 * pages where that is a problem rather than a trade-off:
 *
 *   /admin, /portal, /cyber   Internal tools. Staff sitting on these all day
 *     with ads on the page is the textbook way to accumulate accidental
 *     clicks on your own ads, which Google treats as invalid traffic and
 *     suspends accounts over. Same reasoning as the localhost guard above.
 *
 *   /dashboard                A signed-in traveller's own bookings and
 *     messages. Advertising against someone's private records is not what
 *     "ads on the site" is normally taken to mean.
 *
 *   /signin, /signup, /reset-password
 *     Near-empty pages behind or beside authentication. AdSense policy
 *     specifically discourages ads on screens without publisher content, and
 *     these are the pages most likely to be flagged during review.
 *
 * Everything public — home, listings, categories, destinations, rentals,
 * blog, jobs, the booking widgets on listing pages — still carries ads, as
 * chosen. Remove an entry here to let ads onto that section.
 * ------------------------------------------------------------------------- */
const NO_ADS = [
  "/admin",
  "/portal",
  "/cyber",
  "/dashboard",
  "/signin",
  "/signup",
  "/reset-password",
];

export function AdSense() {
  const pathname = usePathname();
  const consent = useConsent();

  /* Prefix match with a boundary check, so /dashboard and /dashboard/bookings
     are both excluded while a future public route merely starting with the
     same letters is not. */
  const blocked = NO_ADS.some(
    (p) => pathname === p || pathname?.startsWith(`${p}/`)
  );
  if (blocked) return null;

  /* Not rendered, so no script, so no advertising cookie and no
     impression. Same shape as GoogleAnalytics: useConsent() subscribes
     rather than reading once, so pressing Allow starts it on the next
     render without a reload. */
  if (consent !== "granted") return null;

  /* Localhost, preview deployments and any non-canonical host. See above —
     this is the invalid-traffic guard, not an optimisation. */
  if (!IS_INDEXABLE) return null;

  if (!ADSENSE_CLIENT) return null;

  return (
    /* lazyOnload for the same reason GA uses it. adsbygoogle.js is heavy
       third-party JavaScript and the homepage LCP is an image; letting it
       compete for bandwidth during the initial load is what cost ~28
       Lighthouse points last time. Ads still fill after the load event. */
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      strategy="lazyOnload"
      crossOrigin="anonymous"
    />
  );
}
