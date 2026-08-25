"use client";

import * as React from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

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

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

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
  /* No ID configured — render nothing at all. This is what keeps development
     and preview deployments out of the reporting. */
  if (!GA_ID) return null;

  return (
    <>
      {/* lazyOnload, not afterInteractive. gtag.js is ~326 KB of third-party
          JavaScript; on a throttled mobile connection it competes with the
          hero image for bandwidth, and the hero image is the LCP element.
          Loading it with afterInteractive cost about 28 Lighthouse points.
          Waiting for the load event costs the handful of visitors who leave
          within a second or two — a trade worth making.

          Nothing is lost from the delay: gtag() only ever pushes to
          dataLayer, so the page views recorded below queue up and replay in
          order the moment the script arrives. */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="lazyOnload"
      />
      <Script id="ga-init" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
      <RouteChangeTracker />
    </>
  );
}
