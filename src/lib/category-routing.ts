import { isRoadsideService } from "@/lib/roadside";
import { isEventCategory } from "@/lib/events";
import { isActivityCategory, isIndoorActivity } from "@/lib/activities";

/* ============================================================
 * Which /categories/[slug] URLs are real pages, and which are
 * only redirects into a dedicated module.
 *
 * Twenty of the thirty-three category slugs redirect the moment
 * they are opened — roadside services go to /roadside, events to
 * /events, activities to /activities. They were still being
 * listed in sitemap.xml, so the sitemap was telling Google to
 * crawl twenty URLs that immediately bounce it somewhere else.
 * That wastes crawl budget and is reported as a sitemap error.
 *
 * The rule lives here so the page and the sitemap cannot drift
 * apart: the page redirects using this function, and the sitemap
 * skips anything it returns a destination for.
 * ============================================================ */

/** Where this category redirects to, or null if it renders its own page. */
export function categoryRedirect(slug: string): string | null {
  // Roadside services have a dedicated, fully-functional module.
  if (isRoadsideService(slug)) return `/roadside/${slug}`;
  // Events & Expo has a dedicated, admin-managed module.
  if (isEventCategory(slug)) return `/events?category=${slug}`;
  // Activities has a dedicated, provider-driven module.
  if (slug === "activities") return "/activities";
  if (slug === "mountaineering") return "/expeditions";
  /* ------------------------------------------------------------------
     /rentals is the canonical home for everything hireable — vehicles
     alongside cameras, camping kit, houses and workspaces. Listing the
     same jeeps at /categories/vehicle-rental as well would be two URLs
     for one set of listings, which is the duplicate-content problem
     this whole file exists to avoid.

     The slug stays in the category list rather than being deleted, so
     saved wishlist rows, existing links and the assistant's category
     mapping still resolve — one redirect away instead of a 404. And
     because the sitemap skips anything this function answers, it stops
     being offered to Google automatically.
     ------------------------------------------------------------------ */
  if (slug === "vehicle-rental") return "/rentals";
  if (isActivityCategory(slug)) {
    return isIndoorActivity(slug)
      ? `/activities?kind=indoor&category=${slug}`
      : `/activities?category=${slug}`;
  }
  return null;
}

/** True when /categories/[slug] is a page in its own right. */
export function categoryHasOwnPage(slug: string): boolean {
  return categoryRedirect(slug) === null;
}

/* ------------------------------------------------------------------ */
/* Empty catch-all pages                                               */
/* ------------------------------------------------------------------ */

/**
 * Categories that may legitimately have nothing in them, and that are served
 * by the generic listings browser rather than a purpose-built view.
 *
 * This is an explicit list rather than a computed one on purpose. Several
 * categories are rendered by their own dedicated components with their own
 * queries, so a count taken from the shared feed is not the whole picture for
 * them — computing this would risk hiding a page that is actually full.
 * Everything not named here stays indexed no matter what.
 */
const MAY_BE_EMPTY = new Set(["visa", "more", "drone-pilots"]);

/**
 * True when this category page currently has nothing to show, and should
 * therefore not be offered to search engines.
 *
 * An empty page is worse than no page: it gives a searcher a dead end and
 * gives Google a reason to think less of the whole site. The moment a
 * provider lists in the category the page starts being indexed again — this
 * is read fresh on every revalidation, not set once.
 *
 * Fails open. If the count cannot be taken, the page stays indexed.
 */
export async function categoryIsEmpty(
  slug: string,
  items: { category?: string | null }[] | null
): Promise<boolean> {
  if (!MAY_BE_EMPTY.has(slug)) return false;
  if (!items) return false;
  return items.filter((l) => l.category === slug).length === 0;
}
