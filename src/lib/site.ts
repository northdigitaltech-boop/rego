/**
 * Central site configuration — the single source of truth for the canonical
 * domain, brand strings and default SEO/social values. Import `siteConfig`
 * everywhere instead of hardcoding "https://rego.services" across the codebase.
 */

const PROD_URL = "https://rego.services";

// Preferred (canonical) origin. Falls back to the production domain. We strip a
// trailing slash so `absoluteUrl("/x")` never produces a double slash.
const rawUrl = (process.env.NEXT_PUBLIC_SITE_URL || PROD_URL).replace(/\/+$/, "");

export const siteConfig = {
  name: "Rego",
  shortName: "Rego",
  url: rawUrl,
  prodUrl: PROD_URL,
  description:
    "Book, explore and experience tourism across Gilgit-Baltistan — hotels, homestays, tour packages, guides, transport, car rentals, activities, restaurants, attractions and more, all in one trusted marketplace.",
  // A real, always-present asset in /public so Open Graph / Twitter cards and
  // JSON-LD never reference a broken image.
  ogImage: "/home-hero.jpg",
  locale: "en_US",
  twitter: "@rego",
  contactPhone: "+923161290604",
} as const;

/**
 * Whether this deployment may be indexed by search engines.
 * Only the real production domain is indexable; preview / staging / local
 * builds are kept out of the index. Overridable via env for edge cases.
 */
export const IS_INDEXABLE: boolean = (() => {
  if (process.env.NEXT_PUBLIC_SEO_NOINDEX === "true") return false;
  if (process.env.NEXT_PUBLIC_SEO_FORCE_INDEX === "true") return true;
  // Must be a production build AND served from the canonical domain. This keeps
  // local dev (NODE_ENV=development) and preview/staging (different host) out of
  // the index automatically, with no per-environment config required.
  if (process.env.NODE_ENV !== "production") return false;
  try {
    return /(^|\.)rego\.services$/.test(new URL(siteConfig.url).host);
  } catch {
    return false;
  }
})();

/** Build an absolute URL against the canonical origin. */
export function absoluteUrl(path: string = ""): string {
  if (!path) return siteConfig.url;
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Search-engine verification tokens (added to <head> when present). */
export const verification = {
  google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || undefined,
  yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || undefined,
};
