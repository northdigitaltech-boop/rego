"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { useConsent } from "@/lib/consent";
import { IS_INDEXABLE } from "@/lib/site";
import { GA4_ID } from "@/lib/google-tag";
import { useVisitTracker } from "@/lib/use-visit-tracker";

/* ============================================================
 * Google Analytics 4.
 *
 * THE PART GOOGLE'S SNIPPET GETS WRONG HERE.
 * The tag Google hands you calls gtag('config', ID), which
 * records one page view when the script loads. On an ordinary
 * site that is enough, because every link is a fresh page
 * load. This is a Next.js App Router site: after the first
 * page, navigation happens client-side and the script never
 * runs again. Pasting the snippet as given would record the
 * page a visitor landed on and then nothing else — every
 * destination, category and listing they went on to read
 * would be invisible.
 *
 * So the config below sets send_page_view: false and the page
 * view is sent from a route listener instead. Exactly one per
 * page, first and subsequent.
 *
 * WHY IT WATCHES THE PATH AND NOT THE QUERY STRING.
 * Changing a filter — /activities?category=fishing — is not a
 * new page. It is the same page with a client-side filter
 * applied, which is also why the canonical tag on those pages
 * deliberately ignores ?category=. Counting each filter click
 * as a page view would inflate the numbers and make the
 * reports say something untrue about how much is being read.
 *
 * It also keeps this component off useSearchParams(), which
 * would drag a Suspense boundary into the root layout and
 * affect static rendering across the whole site.
 *
 * The measurement ID is not a secret — it is visible in the
 * page source of every site running GA. It lives in an env var
 * so local development and Vercel preview builds, which will
 * not have it set, send nothing and keep the real property
 * clean.
 * ============================================================ */

/* Rego's GA4 property (Google tag G-DT6LKTLVMS). Used on the production
   site when NEXT_PUBLIC_GA_ID is not set in Vercel; an env value, if set,
   still wins. IS_INDEXABLE is false on localhost and preview deployments,
   so those still send nothing. */
/* The tag itself (gtag.js + Consent Mode defaults) is in the
   server-rendered <head> — see app/layout.tsx. This component only sends
   page views on client-side navigation and passes the visitor's cookie
   choice on to Google. Production domain only. */
const GA_ID = IS_INDEXABLE ? GA4_ID : undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * gtag() is only ever a push to dataLayer, so calls made before the script has
 * finished loading queue up and run in order once it arrives. Pushing directly
 * means a fast first navigation cannot lose its page view.
 */
function push(...args: unknown[]) {
  if (typeof window === "undefined") return;
  /* The real gtag() from the <head> snippet pushes an `arguments` object,
     which is the only shape gtag.js treats as a command. Use it. */
  if (typeof window.gtag === "function") {
    window.gtag(...args);
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

function RouteChangeTracker() {
  const pathname = usePathname();

  React.useEffect(() => {
    if (!GA_ID || !pathname) return;
    push("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
      send_to: GA_ID,
    });
  }, [pathname]);

  return null;
}

export function GoogleAnalytics() {
  /* Rego's own visit counter. It lives here because this component is already
     mounted once in the root layout, and it is gated on the same answer. */
  useVisitTracker();

  /* ------------------------------------------------------------------
     GA DOES NOT LOAD UNTIL THE VISITOR SAYS YES

     gtag.js writes _ga cookies the moment it runs. Loading it and hoping
     to suppress that afterwards is the pattern regulators keep fining
     people for — the storage has already happened by then.

     Returning null keeps the script off the page entirely. Nothing to
     disable, nothing to clean up, nothing recorded. A visitor who accepts
     gets the script on the next render, because useConsent() subscribes
     to the change rather than reading the cookie once.
     ------------------------------------------------------------------ */
  const consent = useConsent();

  /* ------------------------------------------------------------------
     GOOGLE CONSENT MODE v2 — the tag is on every page, cookies are not.

     Google's setup page could not detect the tag, because it only loaded
     after a visitor pressed Accept. Now gtag.js loads on every page, but
     BEFORE it loads, consent is set to "denied" for analytics and ads
     storage. With "denied", Google writes no cookies and stores nothing
     on the device; it only receives cookieless pings. When the visitor
     presses Accept, consent is updated to "granted" (effect below) and
     normal measurement starts. Pressing Decline keeps it denied.
     ------------------------------------------------------------------ */
  React.useEffect(() => {
    if (!consent) return;
    const v = consent === "granted" ? "granted" : "denied";
    push("consent", "update", {
      analytics_storage: v,
      ad_storage: v,
      ad_user_data: v,
      ad_personalization: v,
    });
  }, [consent]);

  if (!GA_ID) return null;

  return (
    <>
      <RouteChangeTracker />
    </>
  );
}
