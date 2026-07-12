import { siteConfig, absoluteUrl } from "@/lib/site";

/**
 * Server-rendered JSON-LD. Renders a single <script type="application/ld+json">.
 * `null`/`undefined` values are stripped so we never emit empty properties, and
 * the payload is safely escaped against "</script>" breakout.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const clean = Array.isArray(data) ? data.map(prune) : prune(data);
  const json = JSON.stringify(clean).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** Recursively remove null / undefined / "" / empty-array/object props. */
function prune<T>(value: T): T {
  if (Array.isArray(value)) {
    const arr = value.map(prune).filter((v) => v !== undefined);
    return arr as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const pv = prune(v);
      if (
        pv === null ||
        pv === undefined ||
        pv === "" ||
        (Array.isArray(pv) && pv.length === 0)
      )
        continue;
      out[k] = pv;
    }
    return out as unknown as T;
  }
  return value;
}

/* ------------------------------------------------------------------ */
/* Reusable schema builders (return plain objects for <JsonLd data>).  */
/* ------------------------------------------------------------------ */

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl(siteConfig.ogImage),
    description: siteConfig.description,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: siteConfig.contactPhone,
      contactType: "customer support",
      areaServed: "PK",
    },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/listings?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbSchema(items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

interface PlaceInput {
  type: "LodgingBusiness" | "Hotel" | "Restaurant" | "TravelAgency" | "LocalBusiness" | "TouristAttraction";
  name: string;
  description?: string | null;
  image?: string | null;
  path: string;
  location?: string | null;
  address?: string | null;
  phone?: string | null;
  priceRange?: string | null;
  // Only pass a rating when a REAL aggregate exists (never fabricate).
  ratingValue?: number | null;
  reviewCount?: number | null;
}

/** Generic LocalBusiness-style schema used by hotels, restaurants, providers, etc. */
export function businessSchema(p: PlaceInput) {
  return {
    "@context": "https://schema.org",
    "@type": p.type,
    name: p.name,
    description: p.description || undefined,
    image: p.image ? absoluteUrl(p.image) : undefined,
    url: absoluteUrl(p.path),
    telephone: p.phone || undefined,
    priceRange: p.priceRange || undefined,
    address:
      p.address || p.location
        ? {
            "@type": "PostalAddress",
            streetAddress: p.address || undefined,
            addressLocality: p.location || undefined,
            addressRegion: "Gilgit-Baltistan",
            addressCountry: "PK",
          }
        : undefined,
    aggregateRating:
      p.ratingValue && p.reviewCount
        ? {
            "@type": "AggregateRating",
            ratingValue: p.ratingValue,
            reviewCount: p.reviewCount,
          }
        : undefined,
  };
}

interface ArticleInput {
  title: string;
  description?: string | null;
  image?: string | null;
  path: string;
  authorName?: string | null;
  publishedTime?: string | null;
  modifiedTime?: string | null;
}

export function articleSchema(a: ArticleInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description || undefined,
    image: a.image ? absoluteUrl(a.image) : undefined,
    mainEntityOfPage: absoluteUrl(a.path),
    author: a.authorName ? { "@type": "Person", name: a.authorName } : { "@type": "Organization", name: siteConfig.name },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: absoluteUrl(siteConfig.ogImage) },
    },
    datePublished: a.publishedTime || undefined,
    dateModified: a.modifiedTime || a.publishedTime || undefined,
  };
}

interface EventInput {
  name: string;
  description?: string | null;
  image?: string | null;
  path: string;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
}

export function eventSchema(e: EventInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.name,
    description: e.description || undefined,
    image: e.image ? absoluteUrl(e.image) : undefined,
    url: absoluteUrl(e.path),
    startDate: e.startDate || undefined,
    endDate: e.endDate || undefined,
    eventStatus: "https://schema.org/EventScheduled",
    location: e.location
      ? {
          "@type": "Place",
          name: e.location,
          address: { "@type": "PostalAddress", addressLocality: e.location, addressRegion: "Gilgit-Baltistan", addressCountry: "PK" },
        }
      : undefined,
  };
}
