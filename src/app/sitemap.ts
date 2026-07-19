import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";
import { allCategories, destinations } from "@/lib/data";
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
  for (const p of ["/listings", "/destinations", "/safarnama", "/events", "/activities", "/roadside", "/coworking", "/connect", "/expeditions", "/about", "/how-it-works", "/contact", "/partner"]) {
    add(p, { changeFrequency: "weekly", priority: 0.7 });
  }
  for (const c of allCategories) add(`/categories/${c.slug}`, { changeFrequency: "daily", priority: 0.8 });
  for (const d of destinations) add(`/destinations/${d.slug}`, { changeFrequency: "weekly", priority: 0.7 });

  // --- Legal & policy pages ---
  add("/legal", { changeFrequency: "monthly", priority: 0.4 });
  for (const p of legalPolicies) add(`/legal/${p.slug}`, { changeFrequency: "monthly", priority: 0.3 });

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

  return urls;
}
