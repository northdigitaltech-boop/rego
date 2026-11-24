/* ============================================================
 * Live listing counts for destinations.
 *
 * The cards used to print the admin-typed `stays` text ("120+ STAY
 * AVAILABLE", "200+") — a number nobody computed. A launch review
 * counted 54 listings in total and 6 hotels in Skardu. Every count a
 * visitor sees is now computed here from the live listings, with the
 * SAME location rule the listings browser uses when you open that
 * destination — so the number on the card is the number of results
 * you get after clicking it. Exact, never rounded up, and nothing at
 * all when the count is zero.
 * ============================================================ */

type HasLocation = { location?: string | null };

/* "Gilgit-Baltistan" / "Gilgit Baltistan" / "GB" is the REGION, not the
   city of Gilgit. Without removing it first, every listing whose location
   just says "Gilgit Baltistan" matched the Gilgit filter — which is how the
   Hunza page came to show Gilgit-wide listings. */
const REGION_RE = /\bgilgit[\s\u2010-\u2015-]*baltistan\b|\bg\.?\s?b\b/gi;

export function normalizePlace(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(REGION_RE, " ")
    .replace(/[,()/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The listings-browser location test, region-aware. Used by the browser too. */
export function matchesDestination(listingLocation: string | null | undefined, destLocation: string): boolean {
  const a = normalizePlace(listingLocation);
  const b = normalizePlace(destLocation);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * The word a destination's listings are filtered by.
 *
 * Normally the destination's `location` field. But that field is typed in
 * the admin and can drift from the page — the Hunza Valley destination
 * filtered by "Gilgit". When the location has nothing in common with the
 * destination's own name, the name (without "Valley"/"District") is used.
 */
export function destinationFilterTerm(d: { name: string; location?: string | null }): string {
  const core = d.name.replace(/\s+(valley|district|city|town)$/i, "").trim();
  const loc = (d.location ?? "").trim();
  if (!loc) return core;
  const n = normalizePlace(d.name);
  const l = normalizePlace(loc);
  return l && (n.includes(l) || l.includes(normalizePlace(core))) ? loc : core;
}

export function countForDestination(destLocation: string, listings: HasLocation[]): number {
  return listings.filter((l) => matchesDestination(l.location, destLocation)).length;
}

/** "1 listing", "6 listings", or undefined for none. */
export function listingCountLabel(n: number): string | undefined {
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `${n} listing${n === 1 ? "" : "s"}`;
}

/** Replace each destination's typed `stays` with the live count label. */
export function withLiveCounts<T extends { name: string; location: string; stays?: string }>(
  destinations: T[],
  listings: HasLocation[] | null
): T[] {
  /* Listings failed to load: show no count rather than an old typed one. */
  if (!listings) return destinations.map((d) => ({ ...d, stays: undefined }));
  return destinations.map((d) => ({
    ...d,
    stays: listingCountLabel(
      countForDestination(destinationFilterTerm(d), listings)
    ),
  }));
}
