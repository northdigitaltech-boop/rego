import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";
import { allCategories, destinations } from "@/lib/data";
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

type Row = { id: string; updated_at?: string | null; created_at?: string | null };
const when = (r: Row, fallback: Date) =>
  r.updated_at ? new Date(r.updated_at) : r.created_at ? new Date(r.created_at) : fallback;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [];
  const add = (path: string, opts: Partial<MetadataRoute.Sitemap[number]> = {}) =>
    urls.push({ url: absoluteUrl(path), lastModified: now, changeFrequency: "weekly", priority: 0.6, ...opts });

  // --- Static, indexable marketing/landing pages ---
  add("/", { changeFrequency: "daily", priority: 1 });
  for (const p of ["/listings", "/destinations", "/safarnama", "/events", "/activities", "/roadside", "/coworking", "/connect", "/expeditions", "/about", "/how-it-works", "/contact", "/partner", "/careers", "/jobs", "/editorial-policy", "/blog-news"]) {
    add(p, { changeFrequency: "weekly", priority: 0.7 });
  }
  /* Twenty of the category slugs redirect straight into /roadside,
     /events or /activities. Listing them here asked Google to crawl
     twenty URLs that immediately bounce — so only real pages go in. */
  for (const c of allCategories) {
    if (!categoryHasOwnPage(c.slug)) continue;
    add(`/categories/${c.slug}`, { changeFrequency: "daily", priority: 0.8 });
  }
  for (const d of destinations) add(`/destinations/${d.slug}`, { changeFrequency: "weekly", priority: 0.7 });

  // --- Legal & policy pages ---
  add("/legal", { changeFrequency: "monthly", priority: 0.4 });
  for (const p of legalPolicies) add(`/legal/${p.slug}`, { changeFrequency: "monthly", priority: 0.3 });

  // --- Published jobs (SEO-friendly /jobs/[slug] routes) ---
  const jobs = await safe(getPublishedJobs);
  for (const j of (jobs as { slug?: string | null; updated_at?: string }[])) {
    if (!j?.slug) continue;
    urls.push({
      url: absoluteUrl(`/jobs/${j.slug}`),
      lastModified: j.updated_at ? new Date(j.updated_at) : now,
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
      lastModified: new Date(post.updated_at || post.published_at || now),
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

  /* Deduplicate. A destination that exists both in the hardcoded list in
     lib/data.ts and in the locations table would otherwise appear twice,
     and a duplicated URL in a sitemap is a signal that the site does not
     know its own structure. */
  const seen = new Set<string>();
  return urls.filter((u) => {
    const key = String(u.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

    for (const r of rows) {
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
        lastModified: r.content_updated_at
          ? new Date(r.content_updated_at)
          : new Date(),
      });
    }

    return out;
  } catch {
    return [];
  }
}
