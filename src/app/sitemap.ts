import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";
import { allCategories } from "@/lib/data";
import { getPublishedJobs } from "@/lib/jobs";
import { getAllPublishedPosts } from "@/lib/blog";
import { getHotels } from "@/lib/hotels";
import { getHomestays } from "@/lib/homestays";
import { getHostels } from "@/lib/hostels";
import { getApprovedActivities } from "@/lib/activities";
import { getPublishedEvents } from "@/lib/events";
import { getApprovedRestaurants } from "@/lib/restaurants";
import { getApprovedCompanies, getApprovedPackages, getApprovedGuides } from "@/lib/tour-companies";
import { getApprovedProviders, getApprovedRentals } from "@/lib/transport";
import { getApprovedMediaProviders } from "@/lib/media";
import { getApprovedCoworking } from "@/lib/coworking";
import { getApprovedRoadsideProviders } from "@/lib/roadside";
import { getApprovedStories } from "@/lib/safarnama";
import { legalPolicies } from "@/lib/legal";
import { getApprovedCompanies as getExpeditionCompanies, getApprovedPros as getExpeditionPros } from "@/lib/expeditions";
import { categoryHasOwnPage } from "@/lib/category-routing";
import { RENTAL_TYPE_DEFS } from "@/lib/rentals";
import { getDestinations } from "@/lib/destinations";

// Re-generate the sitemap at most hourly.
export const revalidate = 3600;

/** Never let one failing data source break the whole sitemap. */
async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return (await fn()) ?? [];
  } catch {
    return [];
  }
}

/**
 * A Date that is definitely serializable.
 *
 * ---------------------------------------------------------------------------
 * THIS IS WHY A SITEMAP BUILD FAILS
 *
 * `new Date("not a date")` does not throw — it returns Invalid Date, quietly.
 * Next then calls .toISOString() on it while writing the XML, and THAT throws
 * RangeError: Invalid time value. The build fails on /sitemap.xml with no clue
 * which of twenty tables held the bad timestamp.
 *
 * One null, one empty string or one malformed timestamp anywhere in jobs,
 * blog posts, hotels, guides, stories or SEO content was enough to stop a
 * deployment. That is far too much power for a single cell in a table an
 * admin can edit.
 * ---------------------------------------------------------------------------
 */
function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback : value;
  if (typeof value !== "string" || !value.trim()) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

type Row = { id: string; updated_at?: string | null; created_at?: string | null };
const when = (r: Row, fallback: Date) =>
  toDate(r.updated_at ?? r.created_at, fallback);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [];
  const add = (path: string, opts: Partial<MetadataRoute.Sitemap[number]> = {}) =>
    urls.push({ url: absoluteUrl(path), lastModified: now, changeFrequency: "weekly", priority: 0.6, ...opts });

  // --- Static, indexable marketing/landing pages ---
  add("/", { changeFrequency: "daily", priority: 1 });
  for (const p of ["/listings", "/destinations", "/safarnama", "/events", "/activities", "/roadside", "/coworking", "/connect", "/expeditions", "/rentals", "/about", "/how-it-works", "/contact", "/partner", "/careers", "/jobs", "/editorial-policy", "/blog-news"]) {
    add(p, { changeFrequency: "weekly", priority: 0.7 });
  }
  /* One indexable URL per rental type. These are what "jeep rental skardu"
     style queries land on, and each is a genuinely different list — unlike
     the price and rating filters, which are excluded on purpose because
     they only reorder the same rows. */
  for (const d of RENTAL_TYPE_DEFS) {
    if (d.type === "other") continue;
    add(`/rentals?type=${d.slug}`, { changeFrequency: "daily", priority: 0.7 });
  }
  /* Twenty of the category slugs redirect straight into /roadside,
     /events or /activities. Listing them here asked Google to crawl
     twenty URLs that immediately bounce — so only real pages go in. */
  for (const c of allCategories) {
    if (!categoryHasOwnPage(c.slug)) continue;
    add(`/categories/${c.slug}`, { changeFrequency: "daily", priority: 0.8 });
  }
  // --- Legal & policy pages (static, cannot fail) ---
  add("/legal", { changeFrequency: "monthly", priority: 0.4 });
  for (const p of legalPolicies) add(`/legal/${p.slug}`, { changeFrequency: "monthly", priority: 0.3 });

  /* ------------------------------------------------------------------
     Everything below this line reads the database.

     WHY IT IS ALL INSIDE ONE try
       safe() already catches a failing QUERY. It does not catch anything
       that goes wrong AFTER the rows come back — a bad timestamp, a row
       shaped differently than expected, a slug that is not a string. Those
       threw straight out of this function, and a sitemap that throws does
       not become an empty sitemap: it fails the route, which fails
       `next build`, which fails the deployment. The entire site stops
       shipping because one cell in one table is malformed.

       The header of this file already said a sitemap must never 500. It
       could, until now.

       On failure the static pages above are still returned — a smaller
       sitemap, which crawlers handle fine, instead of no deployment.
     ------------------------------------------------------------------ */
  try {
    await addDatabaseUrls(urls, now);
  } catch {
    /* Intentionally silent: there is nothing a crawler or a visitor can do
       about it, and the static half of the sitemap is still correct. */
  }

  /* Deduplicate, and drop anything that cannot be serialized.

     A destination present both in the hardcoded list in lib/data.ts and in
     the locations table would otherwise appear twice, and a duplicated URL
     in a sitemap is a signal that the site does not know its own structure.

     The validity check is the belt to toDate()'s braces: it guarantees that
     whatever any future code path pushes, this function returns something
     Next can write out. */
  const seen = new Set<string>();
  return urls.filter((u) => {
    const key = String(u.url);
    if (!key || seen.has(key)) return false;
    if (u.lastModified instanceof Date && Number.isNaN(u.lastModified.getTime())) return false;
    seen.add(key);
    return true;
  });
}

/** Everything that needs the database. Pushes into `urls`; may throw. */
async function addDatabaseUrls(urls: MetadataRoute.Sitemap, now: Date): Promise<void> {
  const add = (path: string, opts: Partial<MetadataRoute.Sitemap[number]> = {}) =>
    urls.push({ url: absoluteUrl(path), lastModified: now, changeFrequency: "weekly", priority: 0.6, ...opts });

  /* From the database, not the built-in list — otherwise a destination added
     in the admin never gets crawled, and one deleted there is still offered
     to Google. getDestinations() falls back to the built-in list on its own
     when the table is empty. */
  const dests = (await safe(getDestinations)) as { slug?: string }[];
  for (const d of dests) {
    if (d?.slug) add(`/destinations/${d.slug}`, { changeFrequency: "weekly", priority: 0.7 });
  }

  // --- Published jobs (SEO-friendly /jobs/[slug] routes) ---
  const jobs = await safe(getPublishedJobs);
  for (const j of (jobs as { slug?: string | null; updated_at?: string }[])) {
    if (!j?.slug) continue;
    urls.push({
      url: absoluteUrl(`/jobs/${j.slug}`),
      lastModified: toDate(j.updated_at, now),
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  // --- Blog & News. RLS already limits this to visible posts, so a
  //     scheduled article cannot leak into the sitemap before it is live. ---
  for (const b of await safe(getAllPublishedPosts)) {
    const post = b as unknown as { slug?: string; updated_at?: string; published_at?: string };
    if (!post?.slug) continue;
    urls.push({
      url: absoluteUrl(`/blog-news/${post.slug}`),
      // Content date, not build date — a lastmod that moves every deploy
      // teaches crawlers to ignore it.
      lastModified: toDate(post.updated_at || post.published_at, now),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // --- Dynamic, APPROVED/PUBLISHED listings (only 200-status public URLs) ---
  const [
    hotels, homestays, hostels, activities, events, restaurants,
    companies, packages, guides, transport, rentals,
    media, coworking, roadside, stories, expeditionCos, expeditionPros,
  ] = await Promise.all([
    safe(getHotels), safe(getHomestays), safe(getHostels), safe(getApprovedActivities), safe(getPublishedEvents), safe(getApprovedRestaurants),
    safe(getApprovedCompanies), safe(getApprovedPackages), safe(getApprovedGuides), safe(getApprovedProviders), safe(getApprovedRentals),
    safe(getApprovedMediaProviders), safe(getApprovedCoworking), safe(getApprovedRoadsideProviders), safe(getApprovedStories),
    safe(getExpeditionCompanies), safe(getExpeditionPros),
  ]);

  // Listing-detail routes (all resolve through /listings/[id]).
  const listingGroups: Row[][] = [
    hotels as Row[], homestays as Row[], hostels as Row[], companies as Row[], packages as Row[],
    guides as Row[], transport as Row[], rentals as Row[], media as Row[], restaurants as Row[],
  ];
  for (const group of listingGroups) {
    for (const r of group) {
      if (!r?.id) continue;
      urls.push({ url: absoluteUrl(`/listings/${r.id}`), lastModified: when(r, now), changeFrequency: "weekly", priority: 0.6 });
    }
  }

  // Dedicated public routes.
  const dedicated: [Row[], string, number][] = [
    [activities as Row[], "activities", 0.6],
    [events as Row[], "events", 0.6],
    [coworking as Row[], "coworking", 0.6],
    [roadside as Row[], "roadside/provider", 0.6],
    [stories as Row[], "safarnama", 0.7],
    [expeditionCos as Row[], "expeditions/company", 0.6],
    [expeditionPros as Row[], "expeditions/pro", 0.6],
  ];
  for (const [group, prefix, priority] of dedicated) {
    for (const r of group) {
      if (!r?.id) continue;
      urls.push({ url: absoluteUrl(`/${prefix}/${r.id}`), lastModified: when(r, now), changeFrequency: "weekly", priority });
    }
  }

  /* ---- Market & Area pages -------------------------------------------
     Every candidate is put through decideIndexable(), the SAME function
     the page's own generateMetadata calls. A sitemap that lists pages
     those pages mark noindex is a crawl-budget leak, and it is exactly
     what happens when the rule gets implemented twice.

     Nothing is emitted until the market module is switched on and areas
     are made public, so today this adds zero URLs. -------------------- */
  for (const p of await safeMarketPages()) {
    urls.push({
      url: absoluteUrl(p.path),
      lastModified: p.lastModified,
      changeFrequency: "weekly",
      priority: p.service ? 0.6 : 0.75,
    });
  }

}

/**
 * Location and location+service URLs that genuinely deserve indexing.
 *
 * Returns [] on any failure. A sitemap must never 500 — an unreachable
 * sitemap is worse than an incomplete one, because crawlers back off from
 * the whole site rather than from one section.
 */
async function safeMarketPages(): Promise<
  { path: string; service: string | null; lastModified: Date }[]
> {
  try {
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabase");
    if (!isSupabaseConfigured) return [];

    const { data, error } = await supabase.rpc("seo_page_candidates");
    if (error || !Array.isArray(data)) return [];

    const rows = data as {
      location_id: string;
      location_slug: string;
      service_slug: string | null;
      robots_index: boolean;
      content_updated_at: string | null;
    }[];
    if (rows.length === 0) return [];

    const {
      contentLength,
      decideIndexable,
      getLocationSeo,
      locationPath,
    } = await import("@/lib/location-seo");

    // Listing counts are the expensive part, so resolve each location once
    // rather than once per service.
    const countCache = new Map<string, number>();
    const countFor = async (id: string) => {
      if (countCache.has(id)) return countCache.get(id)!;
      const { data: n } = await supabase.rpc("listing_count_at", { p_location_id: id });
      const v = typeof n === "number" ? n : 0;
      countCache.set(id, v);
      return v;
    };

    const out: { path: string; service: string | null; lastModified: Date }[] = [];

    /* ------------------------------------------------------------------
       A BUDGET, BECAUSE THIS LOOP IS TWO ROUND TRIPS PER ROW

       Every candidate costs a getLocationSeo and a listing_count_at, run
       one after another. That was harmless while the market module was off
       and the RPC returned nothing. The moment areas are made public it
       becomes hundreds of sequential queries inside a route that Next
       generates at build time with a timeout — and a route that times out
       three times fails the build, with an error that says nothing about
       why.

       So: stop after DEADLINE_MS and return what has been collected. A
       sitemap missing its newest area pages until the next revalidation is
       a smaller problem than a site that will not deploy.
       ------------------------------------------------------------------ */
    const DEADLINE_MS = 20_000;
    const startedAt = Date.now();

    for (const r of rows) {
      if (Date.now() - startedAt > DEADLINE_MS) break;

      const seo = await getLocationSeo(r.location_id, r.service_slug).catch(() => null);
      const listingCount = await countFor(r.location_id);

      const decision = decideIndexable({
        // The SQL candidate query already required these four.
        locationIsActive: true,
        locationIsPublic: true,
        seoEnabled: true,
        serviceAvailable: true,
        comingSoon: false,
        robotsIndex: r.robots_index,
        listingCount,
        contentChars: contentLength(seo),
      });

      if (!decision.index) continue;

      out.push({
        path: locationPath(r.location_slug, r.service_slug),
        service: r.service_slug,
        /* lastmod reflects when the CONTENT changed, not when we deployed.
           A lastmod that moves on every build teaches crawlers to ignore it. */
        lastModified: toDate(r.content_updated_at, new Date()),
      });
    }

    return out;
  } catch {
    return [];
  }
}
