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
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
