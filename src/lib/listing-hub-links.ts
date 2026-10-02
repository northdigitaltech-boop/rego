import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getOpenServices, locationPath } from "@/lib/location-seo";
import { getDestinationBySlug } from "@/lib/destinations";
import { tidyName } from "@/lib/seo-copy";

/* ============================================================
 * "Up" links from a single listing to the pages above it:
 * the city + service page ("Hotels in Skardu") and the
 * destination guide ("Skardu travel guide").
 *
 * ---------------------------------------------------------------------------
 * WHY
 *
 * Listing pages only linked back to /listings. The pages most
 * worth ranking — "Hotels in Skardu" and the Skardu guide —
 * received no links from the very hotels they list. Linking a
 * leaf to its hub is how a site tells a search engine which
 * pages are the important ones, and it is also simply where a
 * traveller looking at one Skardu hotel wants to go next.
 *
 * ---------------------------------------------------------------------------
 * EVERY LINK HERE IS CHECKED TO RESOLVE
 *
 * Two different pages, two different conditions:
 *
 *   /destinations/<slug>/<service>  exists when the location is
 *     public AND that service is open there — the same
 *     getOpenServices() the city page itself uses to decide
 *     whether to 404.
 *
 *   /destinations/<slug>  needs a row in `destinations` as well;
 *     the guide page 404s without one even when the location is
 *     public. getDestinationBySlug() returns null in exactly those
 *     cases, so it is the test.
 *
 * Neither link is guessed from the listing's free-text location.
 * The listing's own `location_id` (added in phase72, nullable, not
 * backfilled for every row) is the only source. No id → no links:
 * an absent link costs nothing, a wrong one sends a traveller to
 * the wrong valley.
 * ============================================================ */

/** Listing tables that carry location_id (phase72). `transports` does not. */
const TABLES_WITH_LOCATION = new Set([
  "hotels",
  "homestays",
  "hostels",
  "tour_companies",
  "tour_packages",
  "tour_guides",
  "transport_services",
  "rental_vehicles",
  "media_providers",
  "restaurants",
]);

export interface HubLink {
  href: string;
  label: string;
}

export async function listingHubLinks(
  table: string,
  listingId: string,
  serviceSlug: string
): Promise<HubLink[]> {
  /* The table name is interpolated into a query, so it is checked against a
     fixed allow-list — never taken from anything a request could influence. */
  if (!isSupabaseConfigured || !TABLES_WITH_LOCATION.has(table)) return [];

  try {
    const { data: row } = await supabase
      .from(table)
      .select("location_id")
      .eq("id", listingId)
      .maybeSingle();
    const locationId = (row as { location_id?: string | null } | null)?.location_id;
    if (!locationId) return [];

    /* RLS on `locations` only returns public rows to anonymous readers —
       the same guarantee getPublicLocationBySlug relies on. */
    const { data: loc } = await supabase
      .from("locations")
      .select("id, name, slug")
      .eq("id", locationId)
      .maybeSingle();
    const location = loc as { id: string; name: string; slug: string } | null;
    if (!location?.slug) return [];

    const [open, destination] = await Promise.all([
      getOpenServices(location.id).catch(() => []),
      getDestinationBySlug(location.slug).catch(() => null),
    ]);

    const place = destination?.name ? tidyName(destination.name) : tidyName(location.name);
    const links: HubLink[] = [];

    const svc = open.find((s) => s.slug === serviceSlug);
    if (svc) {
      links.push({
        href: locationPath(location.slug, svc.slug),
        label: `${svc.name} in ${place}`,
      });
    }
    if (destination) {
      links.push({ href: locationPath(location.slug), label: `${place} travel guide` });
    }
    return links;
  } catch {
    /* A lookup failure must never break the listing page itself. */
    return [];
  }
}
