"use client";

import * as React from "react";

import { captureReferral } from "@/lib/referral";

/* ============================================================
 * Notices ?ref= on any page and remembers it.
 *
 * WHY IT SITS IN THE LAYOUT RATHER THAN ON /partner
 *   A marketing executive will put their link wherever it gets
 *   read — a WhatsApp message about a destination page, a card
 *   with the homepage on it, a comment under a blog post. The
 *   provider lands there, browses, and finds the partner page
 *   later by themselves. If capture only happened on /partner,
 *   every one of those referrals would be lost.
 *
 * WHY window.location AND NOT useSearchParams
 *   useSearchParams opts a route out of static rendering and
 *   needs a Suspense boundary around it. Paying that on every
 *   page of the site, to read one query parameter that only
 *   matters in a browser, is a bad trade — this component
 *   already runs client-side only.
 *
 *   The cost is that it reads once, on mount, rather than on
 *   client-side navigation. That is the case that exists: a
 *   referral link is how someone ARRIVES. Nobody navigates from
 *   one Rego page to another and picks up a ref parameter on the
 *   way.
 *
 * Renders nothing. One read, one localStorage write, once.
 * ============================================================ */

export function ReferralCapture() {
  React.useEffect(() => {
    captureReferral(window.location.search);
  }, []);

  return null;
}
