import { cache } from "react";

import { feedAllListings } from "@/lib/home-feed";
import type { Listing } from "@/lib/data";

/* ============================================================
 * Request-scoped deduplication for the expensive feed.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SEPARATE FILE
 *
 * React's cache() is a Server Component API. It cannot be called from
 * a client component, and src/lib/home-feed.ts is imported by one —
 * admin-dashboard.tsx is "use client" and calls feedAllListings().
 * Putting cache() in home-feed.ts would pull a server-only import into
 * that client bundle.
 *
 * So the wrapper lives here instead, and only server pages import it.
 * The suffix in the filename is the signal: -cached means server-side
 * only.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT ACTUALLY FIXES
 *
 * feedAllListings() runs ELEVEN parallel Supabase queries — one per
 * listing table — and flattens them into one array.
 *
 * /categories/[slug] calls it twice in a single request: once inside
 * generateMetadata, to decide whether an empty category should be
 * noindexed, and once in the page body to fill the browser. Next.js
 * runs metadata and body in the same request, so that is 22 queries
 * where 11 would do, on the most-crawled route family on the site.
 *
 * cache() memoises per REQUEST, not across requests. The second caller
 * in the same render gets the first caller's result; the next visitor
 * gets fresh data. Nothing can go stale, no revalidate window changes,
 * and a page that calls it once behaves exactly as before.
 * ============================================================ */

export const cachedAllListings = cache(
  async (): Promise<Listing[]> => feedAllListings()
);
