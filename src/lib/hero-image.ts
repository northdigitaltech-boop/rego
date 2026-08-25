import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { photo } from "@/lib/utils";

/* ============================================================
 * The homepage hero image.
 *
 * Ships with a built-in hero — three pre-sized WebP files in
 * /public, served straight from the CDN. An admin can replace it
 * from the dashboard without a deploy.
 *
 * THE FALLBACK IS THE POINT. Every failure path here returns the
 * built-in hero: no Supabase, no row, column missing because the
 * migration has not run, a URL that is not https. The hero is the
 * first thing a visitor sees and the largest element on the page;
 * it is never allowed to be the thing that breaks.
 * ============================================================ */

/** The three widths the hero is served at, matching the built-in files. */
export const HERO_WIDTHS = [640, 1024, 1536] as const;

export interface HeroImage {
  /** src for the default width. */
  src: string;
  /** Responsive candidates, in the srcSet format. */
  srcSet: string;
  alt: string;
  /** True when this is the file that ships with the app. */
  isDefault: boolean;
}

/** The hero that ships in /public. Used whenever nothing else is set. */
export const DEFAULT_HERO: HeroImage = {
  src: "/hero-1024.webp",
  srcSet: "/hero-640.webp 640w, /hero-1024.webp 1024w, /hero-1536.webp 1536w",
  alt: "",
  isDefault: true,
};

/**
 * The hero's own Cloudinary transformation.
 *
 * photo() applies q_auto, which aims to keep an image looking good on its
 * own. The hero never appears on its own: it sits under a dark green wash
 * with white text over it, so detail that q_auto pays for is detail nobody
 * can see. Lighthouse measured an admin-set hero at 87 KiB and said 67 KiB
 * of that was recoverable — this is where it is recovered.
 *
 * q_auto:eco asks Cloudinary for the same automatic decision at a lower
 * target, rather than a fixed quality that would be wrong for some photos.
 * f_auto still picks AVIF or WebP per browser. c_fill with g_auto crops to
 * the interesting part of the frame instead of the middle, which matters on
 * a phone where only a slice of a wide photo is visible.
 *
 * Anything that is not a Cloudinary URL is passed through untouched — there
 * is nothing we can do to it, and a broken transformation would be worse
 * than a large image.
 */
function heroSrc(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }
  /* Only inject into a plain /upload/ — a URL that already carries a
     transformation was set deliberately and is left alone. */
  if (/\/upload\/[^/]*[,_]/.test(url)) return photo(url, width);

  const height = Math.round((width * 2) / 3);
  return url.replace(
    "/upload/",
    `/upload/f_auto,q_auto:eco,c_fill,g_auto,w_${width},h_${height}/`
  );
}

/** Build the responsive set for an admin-supplied image. */
export function heroFromUrl(url: string, alt?: string | null): HeroImage {
  return {
    src: heroSrc(url, 1024),
    srcSet: HERO_WIDTHS.map((w) => `${heroSrc(url, w)} ${w}w`).join(", "),
    alt: alt?.trim() || "",
    isDefault: false,
  };
}

/**
 * Read the configured hero, or the built-in one.
 *
 * Called from a server component, so the <img> and its preload are in the
 * first HTML response rather than appearing after hydration — which for the
 * LCP element is the whole game.
 */
export async function getHeroImage(): Promise<HeroImage> {
  if (!isSupabaseConfigured) return DEFAULT_HERO;

  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("hero_image_url, hero_image_alt")
      .eq("id", 1)
      .maybeSingle();

    /* An error here is most likely the migration not having run yet, which
       is a normal state, not a fault. */
    if (error || !data) return DEFAULT_HERO;

    const row = data as { hero_image_url?: string | null; hero_image_alt?: string | null };
    const url = row.hero_image_url?.trim();

    /* Checked again in the browser's own terms, not just the database's: this
       string is about to become an <img src> on the busiest page on the site. */
    if (!url || !/^https:\/\//i.test(url)) return DEFAULT_HERO;

    return heroFromUrl(url, row.hero_image_alt);
  } catch {
    return DEFAULT_HERO;
  }
}

/** Save (or clear) the hero. Admin only — enforced by RLS on the table. */
export async function setHeroImage(url: string | null, alt: string | null) {
  const clean = url?.trim() || null;
  if (clean && !/^https:\/\//i.test(clean)) {
    return { error: new Error("The image URL must start with https://") };
  }
  const { error } = await supabase
    .from("platform_settings")
    .update({
      hero_image_url: clean,
      hero_image_alt: alt?.trim() || null,
      hero_updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  return { error };
}
