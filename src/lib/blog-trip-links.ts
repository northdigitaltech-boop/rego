import { getDestinations, getDestinationBySlug } from "@/lib/destinations";
import {
  getOpenServices,
  getPublicLocationBySlug,
  locationPath,
} from "@/lib/location-seo";
import type { BlogPost } from "@/lib/blog";

/* ============================================================
 * "Plan your trip" links under a blog article.
 *
 * ---------------------------------------------------------------------------
 * WHY
 *
 * The blog carries "Hotels in Skardu", "Car Rental in Skardu",
 * "Tour Guides in Skardu" — articles aimed at exactly the queries
 * the bookable pages (/destinations/skardu/hotels…) are built to
 * rank for. With no link between them the two compete, and the
 * article, which cannot take a booking, can win. A link from the
 * article to the bookable page tells a search engine which one
 * is the destination for that intent, and takes the reader to
 * something they can actually book.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS MATCHED, AND WHAT IS NOT
 *
 * Only the title and the tags — what the article is ABOUT. Not
 * the body: "Best Season to Visit Gilgit-Baltistan" names every
 * valley in passing, and linking all of them would say nothing.
 *
 * Every link is checked to resolve before it is offered:
 *   • a destination guide only if getDestinationBySlug() finds it
 *     (the same call that decides whether that page 404s);
 *   • a "Hotels in Skardu" page only if getOpenServices() says the
 *     service is open there (the same call that page uses);
 *   • otherwise the national category page, from a fixed list of
 *     categories that exist.
 * Nothing is guessed from free text into a URL.
 * ============================================================ */

export interface TripLink {
  href: string;
  label: string;
}

/** Service intents an article can be about. Order = display order. */
export const SERVICE_PATTERNS: { slug: string; label: string; re: RegExp }[] = [
  { slug: "hotels", label: "Hotels", re: /\b(hotels?|resorts?)\b/i },
  { slug: "homestays", label: "Homestays", re: /\bhome ?stays?\b/i },
  { slug: "hostels", label: "Hostels", re: /\bhostels?\b/i },
  { slug: "tours", label: "Tour packages", re: /\b(tour|trip|honeymoon|holiday) packages?\b/i },
  /* "Travel Guide" is an article format, not a person you hire — only
     "tour guide" / "local guide" mean the service. */
  { slug: "guides", label: "Tour guides", re: /\b(tour|local|trekking|mountain) guides?\b/i },
  { slug: "transport", label: "Transport", re: /\b(car rental|rent a car|jeeps?|transport|taxi|cabs?)\b/i },
  { slug: "restaurants", label: "Restaurants", re: /\b(restaurants?|cafes?|where to eat)\b/i },
  { slug: "photographers", label: "Photographers", re: /\bphotographers?\b/i },
];

/** Category pages that exist nationally (all in the main navigation). */
const CATEGORY_PAGES = new Set(SERVICE_PATTERNS.map((s) => s.slug));

const ROAD_RE = /\broad (update|status|conditions?|closures?|alerts?)\b/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Names a destination can be referred to by: "Hunza Valley" is also just
 * "Hunza". The short form needs 4+ letters so a stray word cannot match.
 */
export function destinationAliases(name: string): string[] {
  const full = name.trim();
  const short = full.replace(/\s+(valley|district|city|town)$/i, "").trim();
  return short.length >= 4 && short.toLowerCase() !== full.toLowerCase()
    ? [full, short]
    : [full];
}

/** Pure matcher — what the article is about. Exported for tests. */
export function matchTopics(
  text: string,
  destinations: { slug: string; name: string }[]
): { destinationSlugs: string[]; services: string[]; road: boolean } {
  /* "Gilgit-Baltistan" is the region, not the city of Gilgit. Without this,
     every article mentioning the region linked the Gilgit guide. */
  const placeText = text.replace(/\bgilgit[\s\u2010-\u2015-]*baltistan\b/gi, " ");

  const hits: { slug: string; at: number }[] = [];
  for (const d of destinations) {
    let at = -1;
    for (const alias of destinationAliases(d.name)) {
      const m = new RegExp(`\\b${escapeRe(alias)}\\b`, "i").exec(placeText);
      if (m && (at === -1 || m.index < at)) at = m.index;
    }
    if (at >= 0) hits.push({ slug: d.slug, at });
  }
  hits.sort((a, b) => a.at - b.at);

  return {
    // Two at most: an article about Skardu and Shigar, not a link farm.
    destinationSlugs: hits.slice(0, 2).map((h) => h.slug),
    services: SERVICE_PATTERNS.filter((s) => s.re.test(text)).map((s) => s.slug),
    road: ROAD_RE.test(text),
  };
}

export async function blogTripLinks(
  post: Pick<BlogPost, "title" | "tags">
): Promise<TripLink[]> {
  try {
    const text = [post.title, ...(post.tags ?? [])].join(" · ");
    const all = await getDestinations().catch(() => []);
    const topics = matchTopics(text, all);

    const links: TripLink[] = [];
    const seen = new Set<string>();
    const push = (l: TripLink) => {
      if (!seen.has(l.href)) {
        seen.add(l.href);
        links.push(l);
      }
    };

    const servicesLinkedLocally = new Set<string>();

    for (const slug of topics.destinationSlugs) {
      const [destination, location] = await Promise.all([
        getDestinationBySlug(slug).catch(() => null),
        getPublicLocationBySlug(slug).catch(() => null),
      ]);

      if (location && topics.services.length > 0) {
        const open = await getOpenServices(location.id).catch(() => []);
        const place = destination?.name ?? location.name;
        for (const svcSlug of topics.services) {
          const svc = open.find((s) => s.slug === svcSlug);
          if (svc) {
            push({ href: locationPath(slug, svc.slug), label: `${svc.name} in ${place}` });
            servicesLinkedLocally.add(svcSlug);
          }
        }
      }
      if (destination) {
        push({ href: locationPath(slug), label: `${destination.name} travel guide` });
      }
    }

    /* A service the article is about but that has no open local page:
       the national category still answers the reader's intent. */
    for (const svcSlug of topics.services) {
      if (servicesLinkedLocally.has(svcSlug) || !CATEGORY_PAGES.has(svcSlug)) continue;
      const label = SERVICE_PATTERNS.find((s) => s.slug === svcSlug)!.label;
      push({ href: `/categories/${svcSlug}`, label: `${label} in Gilgit-Baltistan` });
    }

    if (topics.road) {
      push({ href: "/roadside/updates", label: "Live road status & alerts" });
    }

    return links.slice(0, 6);
  } catch {
    /* Related links are a nicety; they must never break the article. */
    return [];
  }
}
