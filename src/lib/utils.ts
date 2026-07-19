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
  // Unsplash — append resize params if the caller hasn't sized it already.
  if (url.includes("images.unsplash.com") || url.includes("plus.unsplash.com")) {
    if (/[?&]w=/.test(url)) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}w=${width}&q=70&auto=format&fit=crop`;
  }
  // Cloudinary — inject an f_auto,q_auto,w_<width> transformation once.
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    if (/\/upload\/[^/]*(c_|w_|q_|f_)/.test(url)) return url;
    return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
  }
  return url;
}
