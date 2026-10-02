import type { Metadata } from "next";

import { siteConfig, absoluteUrl, IS_INDEXABLE } from "@/lib/site";

export interface BuildMetadataInput {
  /** Page title WITHOUT the "— Rego" suffix (the template adds it). */
  title?: string;
  /** Full title that bypasses the template (use for the homepage). */
  absoluteTitle?: string;
  description?: string;
  /** Path or absolute URL for the canonical tag, e.g. "/hotels/skardu". */
  path?: string;
  /** Absolute or relative image URL for OG/Twitter. Defaults to the brand image. */
  image?: string | null;
  imageAlt?: string;
  /** og:type — "website", "article", "profile", etc. */
  type?: "website" | "article" | "profile";
  /** Force noindex for utility/private public pages (login, search, previews). */
  noindex?: boolean;
  nofollow?: boolean;
  keywords?: string[];
  publishedTime?: string;
  modifiedTime?: string;
}

/* ============================================================
 * ONE BRAND MENTION PER TITLE
 *
 * The root layout's template is "%s — Rego", so every plain
 * string title gets the brand appended. That is right for a title
 * like "Hotels in Skardu" and wrong for one that already names it.
 *
 * The live result of getting it wrong, from the Skardu hotels page:
 *
 *   Hotels in Skardu | Compare & Book Stays with REGO — Rego
 *
 * Search results truncate around 60 characters, so the second
 * brand mention is not just ugly — it is the part of the title a
 * searcher is most likely to see cut off, spent on a word they
 * already read.
 *
 * Titles reach here from two places that cannot be audited by
 * grepping the code: hardcoded strings, and seo_title values an
 * admin types into the location SEO panel. So the rule is applied
 * to the title itself, wherever it came from.
 * ============================================================ */
const BRAND_RE = /\brego\b/i;

/**
 * A title in the shape Next.js metadata expects. One that already names the
 * brand is passed as `absolute` so the layout template does not add it again;
 * any other is returned plain and gets " — Rego" from the template.
 */
export function brandedTitle(title: string): string | { absolute: string } {
  const t = title.trim();
  return BRAND_RE.test(t) ? { absolute: t } : t;
}

/**
 * One place that assembles a complete, consistent Metadata object: canonical,
 * Open Graph, Twitter card and robots — with environment-aware indexing so
 * previews/staging are never indexed. Use in every `generateMetadata()`.
 */
export function buildMetadata(input: BuildMetadataInput = {}): Metadata {
  const {
    title,
    absoluteTitle,
    description = siteConfig.description,
    path = "/",
    image,
    imageAlt,
    type = "website",
    noindex = false,
    nofollow = false,
    keywords,
    publishedTime,
    modifiedTime,
  } = input;

  const canonical = absoluteUrl(path);
  const ogImage = absoluteUrl(image || siteConfig.ogImage);
  const index = IS_INDEXABLE && !noindex;
  const follow = !nofollow;

  /* absolute in both branches: buildMetadata adds the suffix itself rather
     than relying on the layout template, so it must also be the thing that
     declines to add it when the title already carries the brand. */
  const resolvedTitle = absoluteTitle
    ? absoluteTitle
    : title
      ? {
          absolute: BRAND_RE.test(title)
            ? title.trim()
            : `${title.trim()} — ${siteConfig.name}`,
        }
      : undefined;

  return {
    title: resolvedTitle,
    description,
    keywords,
    alternates: { canonical },
    robots: {
      index,
      follow,
      googleBot: {
        index,
        follow,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      url: canonical,
      title: absoluteTitle || title || siteConfig.name,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: imageAlt || siteConfig.name }],
      ...(type === "article" ? { publishedTime, modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: absoluteTitle || title || siteConfig.name,
      description,
      images: [ogImage],
    },
  };
}

/** Convenience: a full "noindex, nofollow" metadata block for private pages. */
export function noindexMetadata(title?: string): Metadata {
  return buildMetadata({ title, noindex: true, nofollow: true });
}
