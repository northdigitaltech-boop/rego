import type { Metadata } from "next";

import { brandedTitle } from "@/lib/seo";
import { tidyName } from "@/lib/seo-copy";
import { siteConfig, IS_INDEXABLE, absoluteUrl } from "@/lib/site";
import { isStockPhoto } from "@/lib/utils";

/* ============================================================
 * Search metadata for a single provider listing.
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS WRONG
 *
 * Every listing type except hotels returned only a title:
 *
 *     if (p) return { title: `${p.title}` };
 *
 * Anything a page omits it inherits from the root layout, so every
 * tour package, vehicle, guide, restaurant, photographer and travel
 * company shared ONE meta description — the site's own. Hundreds
 * of pages, one identical snippet. No canonical, no share image,
 * and no decision about whether the page was worth indexing.
 *
 * So "7days" by NEXT VOYAGE went to Google as "7days — Rego" with
 * the homepage's description underneath it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DOES INSTEAD
 *
 * Every type is normalised to ListingSeoInput by the caller, then
 * one function builds the whole Metadata object. Title, snippet,
 * canonical, share card and the index decision all come from the
 * listing's own fields, and the rule for each is written down here
 * once instead of nine times.
 *
 * Nothing is invented. A field the provider left empty produces a
 * shorter title or a plainer snippet, never a filler one.
 * ============================================================ */

export interface ListingSeoInput {
  id: string;
  /** What the provider called it. Shown exactly, never rewritten. */
  name: string;
  /** Human label for the kind of thing: "Tour package", "Restaurant". */
  kind: string;
  location?: string | null;
  /** The business behind it, when that is not the listing itself. */
  provider?: string | null;
  /** The provider's own words: description, bio or itinerary. */
  text?: string | null;
  image?: string | null;
  /**
   * Real, PUBLIC structured details — duration, vehicle type, fuel. They
   * count toward the content threshold because for some listing types they
   * are the content: a vehicle has no description field at all.
   *
   * Never pass private fields here. TransportRow carries vehicle_number and
   * driver_contact; they must not end up in a search snippet.
   */
  facts?: (string | null | undefined)[];
  /** Moderation status. Anything other than "approved" is never indexed. */
  status?: string | null;

  /* --- structured data only ------------------------------------------ */

  /** schema.org type. Omitted → no JSON-LD is emitted for this listing. */
  schemaType?: ListingSchemaType;
  /** A street address the provider actually entered. Never synthesised. */
  streetAddress?: string | null;
  /** Lowest nightly/unit price, for lodging priceRange. 0/null → omitted. */
  priceFrom?: number | null;
  priceUnit?: string | null;
}

export type ListingSchemaType =
  | "Hotel"
  | "Resort"
  | "Hostel"
  | "LodgingBusiness"
  | "Restaurant"
  | "TravelAgency"
  | "TouristTrip"
  | "Service";

/* ------------------------------------------------------------------ */
/* Small, pure helpers                                                  */
/* ------------------------------------------------------------------ */

const TITLE_BUDGET = 60;
const SNIPPET_BUDGET = 155;

/* Thresholds for "enough to be worth a search result". Deliberately modest:
   the aim is to keep empty shells out of the index, not to grade prose. */
const MIN_NAME = 3;
const MIN_TEXT = 80;
const MIN_FACTS = 3;

/** Collapse whitespace and newlines; a snippet is one line. */
function clean(s?: string | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Cut at a word boundary and mark the cut, rather than mid-word. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}

function realFacts(facts?: ListingSeoInput["facts"]): string[] {
  return (facts ?? []).map((f) => clean(f)).filter(Boolean);
}

/** A photograph the provider uploaded — not empty, not decorative filler. */
function hasRealPhoto(image?: string | null): boolean {
  const u = clean(image);
  return Boolean(u) && !isStockPhoto(u);
}

/* ------------------------------------------------------------------ */
/* Title                                                                */
/* ------------------------------------------------------------------ */

/**
 * The listing's name, with as much "what and where" as fits.
 *
 * Tries the richest form first and steps down until one fits Google's
 * display width, so context is dropped before the name is ever truncated.
 * A part the name already contains is not repeated:
 *   "Hunza Serena Inn" in Hunza does not become "Hunza Serena Inn | Hunza".
 */
export function listingTitle(i: ListingSeoInput): string {
  const name = clean(i.name);
  const lower = name.toLowerCase();
  const mentions = (s: string) => Boolean(s) && lower.includes(s.toLowerCase());

  const kind = mentions(clean(i.kind)) ? "" : clean(i.kind);
  /* tidyName: providers often type the place in capitals ("HUNZA VALLEY"),
     which reads as shouting in a search result. It leaves mixed case and
     codes like K2 alone. */
  const place = tidyName(clean(i.location));
  /* The place counts as already said if the name holds it whole OR its
     leading word — "Ayash Resort Hunza" in "HUNZA VALLEY" would otherwise
     come out as "Ayash Resort Hunza | Hotel in Hunza Valley". */
  const lead = place.split(/[\s,]+/)[0] ?? "";
  const placeSaid = mentions(place) || (lead.length >= 4 && mentions(lead));
  const where = place && !placeSaid ? place : "";

  const candidates = [
    kind && where ? `${name} | ${kind} in ${where}` : "",
    where ? `${name} | ${where}` : "",
    kind ? `${name} | ${kind}` : "",
    name,
  ].filter(Boolean);

  return candidates.find((c) => c.length <= TITLE_BUDGET) ?? name;
}

/* ------------------------------------------------------------------ */
/* Snippet                                                              */
/* ------------------------------------------------------------------ */

/**
 * The provider's own description when there is enough of it. Otherwise a
 * plain sentence built only from fields they actually filled in.
 */
export function listingDescription(i: ListingSeoInput): string {
  const text = clean(i.text);
  if (text.length >= 70) return clip(text, SNIPPET_BUDGET);

  const name = clean(i.name);
  const place = tidyName(clean(i.location));
  const provider = clean(i.provider);

  let lead =`${clean(i.kind) || "Listing"}${place ? ` in ${place}` : ""}, Gilgit-Baltistan`;
  if (provider && provider.toLowerCase() !== name.toLowerCase()) {
    lead += ` — by ${provider}`;
  }

  const parts = [`${lead}.`];
  const facts = realFacts(i.facts).slice(0, 3);
  if (facts.length) parts.push(`${facts.join(" · ")}.`);
  if (text) parts.push(text);
  parts.push("See details and book on Rego.");

  return clip(parts.join(" "), SNIPPET_BUDGET);
}

/* ------------------------------------------------------------------ */
/* Index decision                                                       */
/* ------------------------------------------------------------------ */

export interface IndexDecision {
  index: boolean;
  /**
   * What the listing lacks — for a provider-facing checklist. Every entry
   * blocks indexing EXCEPT "content", which is advisory: a short description
   * is worth improving but does not make a listing page thin.
   */
  missing: ("name" | "location" | "photo" | "content" | "approval")[];
}

/**
 * Whether this listing is worth a place in search results.
 *
 * NOINDEX IS NOT HIDING. The page stays live, linked and bookable on Rego;
 * it is only kept out of Google until it has enough on it to be useful
 * there. A thin page in the index costs the whole domain a little; the same
 * page kept out of it costs nothing.
 *
 * Content can be met two ways because the listing types differ: a tour
 * package or restaurant has a description field, a vehicle does not — its
 * type, year, fuel and transmission ARE what a renter wants to know.
 */
export function listingIndexability(i: ListingSeoInput): IndexDecision {
  const missing: IndexDecision["missing"] = [];

  if (clean(i.name).length < MIN_NAME) missing.push("name");
  if (!clean(i.location)) missing.push("location");
  if (!hasRealPhoto(i.image)) missing.push("photo");

  /* ------------------------------------------------------------------
     CONTENT IS REPORTED, NOT ENFORCED — AND WHY THAT CHANGED

     The first version also required 80+ characters of description or
     three structured facts. Run against production before it shipped
     (supabase/check-listing-indexability.sql), it marked most of the 57
     approved listings noindex, including Aghosh Skardu, Luckey Palace,
     The Heaven Hotel, Leopard Cave and Touraza Signature — real
     businesses with real photos, shown on the homepage.

     The rule was measuring the wrong thing. It read one text field, but
     a hotel page also renders rooms, amenities, a gallery, a map and a
     booking widget from other tables. A short description does not make
     that page thin. Name, location and a real photo are what separate a
     real listing from an empty shell, so those are what gate indexing.

     "content" is still returned so a provider dashboard can suggest a
     longer description — it just no longer decides the index.
     ------------------------------------------------------------------ */
  const shortOnContent =
    clean(i.text).length < MIN_TEXT && realFacts(i.facts).length < MIN_FACTS;
  /* Defence in depth. RLS (phase30b) already hides unapproved rows from
     anonymous visitors, so Googlebot should never reach one — but an owner
     previewing their own pending listing does, and that page must never say
     index regardless of what the database policies turn out to be. */
  if (i.status && i.status !== "approved") missing.push("approval");

  /* Decided BEFORE content is appended, so content cannot block. */
  const index = missing.length === 0;
  if (shortOnContent) missing.push("content");

  return { index, missing };
}

/* ------------------------------------------------------------------ */
/* The whole Metadata object                                            */
/* ------------------------------------------------------------------ */

/**
 * Canonical is always the bare /listings/<uuid>.
 *
 * extractListingId() pulls a UUID out of any path segment, so
 * /listings/<uuid>, /listings/<name>-<uuid> and /listings/anything-<uuid>
 * all serve the same page. PrettyListingUrl rewrites the address bar to the
 * name form, which is what people copy and share. Without a canonical every
 * one of those is a separate duplicate. The bare form is the one the sitemap
 * lists, so canonical and sitemap agree.
 */
export function listingMetadata(i: ListingSeoInput): Metadata {
  const title = listingTitle(i);
  const description = listingDescription(i);
  const path = `/listings/${i.id}`;
  const decision = listingIndexability(i);
  const index = IS_INDEXABLE && decision.index;

  /* Share card falls back to the brand image, never to a stock photo — a
     stranger's mountain on a WhatsApp preview is the same lie as one on
     the page. */
  const ogImage = hasRealPhoto(i.image) ? clean(i.image) : siteConfig.ogImage;

  return {
    title: brandedTitle(title),
    description,
    alternates: { canonical: path },
    robots: {
      index,
      follow: true,
      googleBot: { index, follow: true, "max-image-preview": "large" },
    },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      url: path,
      title,
      description,
      images: [{ url: ogImage, alt: clean(i.name) }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

/* ============================================================
 * Structured data for a single listing.
 *
 * ---------------------------------------------------------------------------
 * THE RULES THIS FOLLOWS — from Google's own LocalBusiness docs
 *
 *   Required for every LocalBusiness subtype (Hotel, Restaurant,
 *   TravelAgency, …): `name` and `address`. Address sub-fields are
 *   "include as many as possible", not individually required — so
 *   a town and a country is valid, and a street is added only where
 *   the provider actually typed one.
 *
 *   No address we can honestly give → no LocalBusiness block at all.
 *   An invalid block earns a Search Console error; an invented
 *   address is a lie. Emitting nothing is the only honest option.
 *
 *   Guides, vehicles, transport services and tour packages have no
 *   fixed premises, so they use Service / TouristTrip — types that
 *   do not require an address and do not pretend to a shopfront.
 *
 * ---------------------------------------------------------------------------
 * DELIBERATELY NEVER EMITTED
 *
 *   aggregateRating — Google: "only recommended for sites that
 *     capture reviews about other local businesses", and it must
 *     meet the review-snippet rules. Every listing has 0 reviews
 *     today, and the per-listing rating column is not yet proven to
 *     come only from verified reviews. Add it when both are true.
 *   telephone — a provider's number is not necessarily public on
 *     the page; structured data must not expose more than the page.
 *   geo — needs 5-decimal coordinates we do not hold for listings.
 *   addressRegion — Rego lists Swat and Naran (Khyber Pakhtunkhwa),
 *     not only Gilgit-Baltistan; hardcoding a region would be false
 *     for those.
 *
 * description is the provider's own text or nothing — never the
 * generated meta snippet, which carries Rego's own wording.
 * ============================================================ */

const LOCAL_BUSINESS_TYPES = new Set<ListingSchemaType>([
  "Hotel",
  "Resort",
  "Hostel",
  "LodgingBusiness",
  "Restaurant",
  "TravelAgency",
]);

const LODGING_TYPES = new Set<ListingSchemaType>([
  "Hotel",
  "Resort",
  "Hostel",
  "LodgingBusiness",
]);

export function listingJsonLd(i: ListingSeoInput): Record<string, unknown> | null {
  const type = i.schemaType;
  const name = clean(i.name);
  if (!type || !name) return null;

  const place = tidyName(clean(i.location));
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    name,
    url: absoluteUrl(`/listings/${i.id}`),
  };
  if (hasRealPhoto(i.image)) ld.image = clean(i.image);
  const own = clean(i.text);
  if (own) ld.description = clip(own, 300);

  if (LOCAL_BUSINESS_TYPES.has(type)) {
    /* Required by Google. No real place → no block, not a broken one. */
    if (!place) return null;
    const street = clean(i.streetAddress);
    ld.address = {
      "@type": "PostalAddress",
      ...(street ? { streetAddress: street } : {}),
      addressLocality: place,
      addressCountry: "PK",
    };
    const from = Number(i.priceFrom);
    if (LODGING_TYPES.has(type) && Number.isFinite(from) && from > 0) {
      const unit = clean(i.priceUnit);
      ld.priceRange = `From PKR ${from.toLocaleString("en-PK")}${unit ? ` / ${unit}` : ""}`;
    }
    return ld;
  }

  const provider = clean(i.provider);
  if (provider && provider.toLowerCase() !== name.toLowerCase()) {
    ld.provider = { "@type": "Organization", name: provider };
  }

  if (type === "Service") {
    ld.serviceType = clean(i.kind);
    if (place) ld.areaServed = { "@type": "Place", name: place };
  }

  return ld;
}
