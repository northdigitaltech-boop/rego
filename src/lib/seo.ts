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

  const resolvedTitle = absoluteTitle
    ? absoluteTitle
    : title
      ? { absolute: `${title} — ${siteConfig.name}` }
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
