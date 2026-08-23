import type { MetadataRoute } from "next";

import { siteConfig, IS_INDEXABLE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Non-production hosts (preview / staging / local): disallow everything so a
  // stray deployment can never get indexed. Auth still protects these routes;
  // this is defence in depth, not the only guard.
  if (!IS_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private app areas, auth pages and utility/transactional routes + API.
      // These are also protected by authentication and per-page noindex.
      // NOTE: we deliberately do NOT block "?" query strings here so that
      // paginated URLs (?page=2) stay crawlable; filter/sort permutations are
      // controlled with per-page `noindex, follow` metadata instead.
      disallow: [
        "/admin",
        /* The security portal. It was missing here — it carries a page-level
           noindex, but a private incident-response surface should not be
           crawled at all. Normally you avoid blocking a page whose noindex
           the crawler needs to read; that rule does not apply to a route
           nobody outside the team should reach. */
        "/cyber",
        "/dashboard",
        "/api/",
        "/signin",
        "/signup",
        "/reset-password",
        "/wishlist",
        "/messages",
        "/connect/setup",
        "/connect/requests",
        "/safarnama/create",
        // PWA fallback shell — real content, no unique value, never a landing page.
        "/offline",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
