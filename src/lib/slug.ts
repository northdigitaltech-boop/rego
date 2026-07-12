import { slugify } from "@/lib/utils";

/**
 * SEO slug system (reusable across every listing type).
 *
 * Design rules (see SEO spec §6):
 *  - lowercase, hyphen-separated, unsupported characters removed
 *  - a PUBLISHED slug must never silently change when the listing name is edited
 *  - duplicates get a short numeric suffix ("-2", "-3", …)
 *  - old slugs are preserved so a 301 redirect can be created (see slug_history
 *    table + redirects table in supabase/phase47-seo.sql)
 */

export { slugify };

/**
 * Given a desired base name and the set of slugs already taken, return a unique
 * slug. Pass the record's own current slug in `own` so re-saving keeps it.
 */
export function uniqueSlug(name: string, taken: Iterable<string>, own?: string | null): string {
  const base = slugify(name);
  const set = new Set(taken);
  if (own) set.delete(own);
  if (!set.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!set.has(candidate)) return candidate;
  }
  // Extremely unlikely; fall back to a time-based suffix.
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Decide the slug to persist on save.
 *  - Not yet published → always track the (possibly new) name.
 *  - Already published → keep the existing slug UNLESS an admin explicitly
 *    overrides it. Returns { slug, changedFrom } so the caller can insert a
 *    301 redirect + slug_history row when the slug actually changes.
 */
export function resolveSlugOnSave(opts: {
  name: string;
  currentSlug?: string | null;
  isPublished: boolean;
  adminOverrideSlug?: string | null;
  taken: Iterable<string>;
}): { slug: string; changedFrom: string | null } {
  const { name, currentSlug, isPublished, adminOverrideSlug, taken } = opts;

  if (adminOverrideSlug && adminOverrideSlug.trim()) {
    const slug = uniqueSlug(adminOverrideSlug, taken, currentSlug);
    return { slug, changedFrom: currentSlug && currentSlug !== slug ? currentSlug : null };
  }

  if (isPublished && currentSlug) {
    // Published slugs are permanent unless overridden above.
    return { slug: currentSlug, changedFrom: null };
  }

  const slug = uniqueSlug(name, taken, currentSlug);
  return { slug, changedFrom: currentSlug && currentSlug !== slug ? currentSlug : null };
}

/** Build the readable listing path used across the site: `/listings/<slug>-<id>`. */
export function prettyListingPath(name: string | null | undefined, id: string): string {
  return `/listings/${slugify(name)}-${id}`;
}
