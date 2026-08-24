import { siteConfig, absoluteUrl, companyRegistration } from "@/lib/site";
import { aboutContent } from "@/lib/about-content";

/* ============================================================
 * JSON-LD structured data.
 *
 * ---------------------------------------------------------------------------
 * ONE RULE: SCHEMA MUST DESCRIBE WHAT IS ACTUALLY ON THE PAGE.
 *
 * Every helper below takes only data the page itself renders.
 * There is no aggregateRating helper, no "availability" helper
 * and no review markup, because Rego has no verified source for
 * those on a destination page — and marking up a rating that a
 * visitor cannot see is exactly what earns a structured-data
 * manual action.
 *
 * FAQPage is emitted ONLY when the FAQs are visibly displayed.
 * The caller passes the same array it renders, so the two
 * cannot drift.
 * ---------------------------------------------------------------------------
 */

/**
 * Emit one schema object, or several.
 *
 * Exported and array-tolerant because layout.tsx and /jobs/[slug] already
 * call it with an array — `<JsonLd data={[organizationSchema(), websiteSchema()]} />`.
 */
export function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}) {
  const payload = Array.isArray(data)
    ? data.filter(Boolean)
    : [data].filter(Boolean);
  if (payload.length === 0) return null;

  return (
    <>
      {payload.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Built server-side from our own data, never from user input.
          // The escape closes the <script> injection vector regardless.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(d).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Site-wide schemas                                                   */
/* ------------------------------------------------------------------ */

/**
 * Organization.
 *
 * Carries the facts that make the entity checkable rather than merely
 * described: the registered legal name, the SECP registration number, and the
 * founder. Every one of these can be verified independently, which is the
 * only kind of trust signal worth emitting.
 *
 * `identifier` and `sameAs` point at the public SECP record. Nothing here is
 * a claim about quality.
 */
export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    legalName: companyRegistration.legalName,
    url: siteConfig.url,
    logo: absoluteUrl(siteConfig.ogImage),
    email: siteConfig.contactEmail,
    telephone: siteConfig.contactPhone,
    foundingDate: "2026-07-13",
    founder: {
      "@type": "Person",
      name: aboutContent.founder.name,
      jobTitle: aboutContent.founder.position,
    },
    identifier: {
      "@type": "PropertyValue",
      name: "SECP CUIN",
      value: companyRegistration.cuin,
    },
    // The public registration record — verifiable, not self-asserted.
    sameAs: [companyRegistration.verifyUrl],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Skardu",
      addressRegion: "Gilgit-Baltistan",
      addressCountry: "PK",
    },
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Gilgit-Baltistan, Pakistan",
    },
    publishingPrinciples: absoluteUrl("/editorial-policy"),
  };
}

/** WebSite, with the search action pointed at the real listings query param. */
export function websiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/listings?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

/** BreadcrumbList. Pass the same trail the page renders visually. */
export function BreadcrumbJsonLd({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: absoluteUrl(c.path),
        })),
      }}
    />
  );
}

/**
 * TouristDestination.
 *
 * Only fields we genuinely hold are emitted. `geo` is omitted entirely when
 * coordinates are missing rather than sent as null, because a null coordinate
 * is worse than no coordinate — it asserts we know and the answer is nothing.
 */
export function TouristDestinationJsonLd({
  name,
  description,
  image,
  path,
  latitude,
  longitude,
  containedIn,
}: {
  name: string;
  description?: string | null;
  image?: string | null;
  path: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Parent area name, e.g. "Gilgit-Baltistan". */
  containedIn?: string | null;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name,
    url: absoluteUrl(path),
  };
  if (description) data.description = description;
  if (image) data.image = image;
  if (latitude != null && longitude != null) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude,
      longitude,
    };
  }
  if (containedIn) {
    data.containedInPlace = { "@type": "Place", name: containedIn };
  }
  return <JsonLd data={data} />;
}

/**
 * FAQPage — ONLY call this when the same FAQs are rendered on screen.
 *
 * Google's guidelines require the content to be visible. Emitting hidden FAQ
 * markup is a common way sites lose rich results across the whole domain, not
 * just on the offending page.
 */
export function FaqJsonLd({ items }: { items: { q: string; a: string }[] }) {
  const clean = items.filter((f) => f.q?.trim() && f.a?.trim());
  if (clean.length === 0) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: clean.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }}
    />
  );
}

/**
 * ItemList for a set of listings shown on a location+service page.
 *
 * Names and URLs only. No prices, no ratings, no availability — those change
 * per date and per room, and marking up a price the page does not guarantee
 * is a promise to a search engine that the booking flow may not keep.
 */
export function ListingItemListJsonLd({
  items,
  name,
}: {
  items: { title: string; path: string }[];
  name: string;
}) {
  if (items.length === 0) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name,
        numberOfItems: items.length,
        itemListElement: items.slice(0, 30).map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.title,
          url: absoluteUrl(it.path),
        })),
      }}
    />
  );
}
