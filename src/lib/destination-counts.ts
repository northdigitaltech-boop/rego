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

/** Same test as ListingsBrowser's location filter. */
export function matchesDestination(listingLocation: string | null | undefined, destLocation: string): boolean {
  const a = (listingLocation ?? "").toLowerCase().trim();
  const b = destLocation.toLowerCase().trim();
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
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
export function withLiveCounts<T extends { location: string; stays?: string }>(
  destinations: T[],
  listings: HasLocation[] | null
): T[] {
  /* Listings failed to load: show no count rather than an old typed one. */
  if (!listings) return destinations.map((d) => ({ ...d, stays: undefined }));
  return destinations.map((d) => ({
    ...d,
    stays: listingCountLabel(countForDestination(d.location, listings)),
  }));
}
