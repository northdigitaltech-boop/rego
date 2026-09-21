import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number | null | undefined, currency = "PKR") {
  const n = typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
  return `${currency} ${n.toLocaleString("en-US")}`;
}

/** URL-friendly slug from a name (e.g. "Aliyar House" → "aliyar-house"). */
export function slugify(name: string | null | undefined): string {
  return (name || "listing")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "listing";
}

/**
 * Listing detail URLs can be "<name-slug>-<uuid>" for readability. This pulls
 * the real id back out: returns the trailing UUID if present, else the raw
 * value (supports demo ids like "l1").
 */
export function extractListingId(param: string): string {
  const m = param.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return m ? m[0] : param;
}

/**
 * Normalizes image URLs. The sample data uses loremflickr.com, which is
 * unreliable and often fails to load, so we rewrite those to Lorem Picsum
 * (stable per seed). Real images (Cloudinary, Unsplash, pravatar, etc.) and
 * any other host are returned unchanged.
 */
export function photo(url?: string | null, width = 1080) {
  /* ------------------------------------------------------------------
     GUARD AGAINST `array.map(photo)`.

     map() hands its callback three arguments — (value, index, array) —
     so `gallery.map(photo)` silently becomes photo(url, 0),
     photo(url, 1), photo(url, 2)… and the second parameter here is the
     WIDTH. Cloudinary rejects w_0 outright, so the first thumbnail
     broke, and w_1 through w_3 returned images one to three pixels
     wide, which stretch across the tile as grey smudges. It looked
     like missing images; it was the index.

     Seven galleries were written that way. Fixing the call sites is
     not enough on its own: the next person to write .map(photo) would
     reintroduce it and see the same unexplainable result. Anything
     below a plausible thumbnail falls back to the default instead.
     ------------------------------------------------------------------ */
  if (!Number.isFinite(width) || width < 64) width = 1080;

  if (!url) return `https://picsum.photos/seed/safarigb/${width}/${Math.round(width * 0.66)}`;
  if (url.includes("loremflickr.com")) {
    const m = url.match(
      /loremflickr\.com\/(\d+)\/(\d+)\/([^?]*)(?:\?lock=(\d+))?/
    );
    if (m) {
      const [, w, h, rawKeywords, lock] = m;
      const seed =
        (rawKeywords || "gb")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") + (lock || "");
      return `https://picsum.photos/seed/${seed}/${w}/${h}`;
    }
  }
  return optimizeImg(url, width);
}

/**
 * Cap remote images to a sensible delivery size with modern formats. Unsplash
 * and Cloudinary both support on-the-fly resizing, so this dramatically cuts
 * payloads (full-res originals can be several MB) without any visible change.
 * Pass a smaller `width` for thumbnails/cards so mobile doesn't download a
 * full-width image for a small tile.
 */
function optimizeImg(url: string, width: number): string {
  // Unsplash — set or replace the width so the requested size always wins
  // (some listings are run through photo() twice).
  if (url.includes("images.unsplash.com") || url.includes("plus.unsplash.com")) {
    if (/[?&]w=\d+/.test(url)) return url.replace(/([?&]w=)\d+/, `$1${width}`);
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}w=${width}&q=70&auto=format&fit=crop`;
  }
  // Cloudinary — replace an existing width in the transformation, else inject one.
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    if (/\/upload\/[^/]*w_\d+/.test(url)) {
      return url.replace(/(\/upload\/[^/]*?)w_\d+/, `$1w_${width}`);
    }
    if (/\/upload\/[^/]*(c_|q_|f_)/.test(url)) return url;
    return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
  }
  return url;
}
