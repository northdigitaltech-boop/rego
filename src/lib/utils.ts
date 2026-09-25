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

  /* ------------------------------------------------------------------
     NO IMAGE → SAY SO, DO NOT INVENT ONE

     This used to return a random picsum photograph, which is how a
     listing with no picture ended up showing a stranger's mountain on
     every card that rendered it. The traveller had no way to tell that
     apart from a photo the provider actually supplied.

     /no-photo.svg is a flat brand-coloured panel that reads "No photo
     yet". It is a few hundred bytes, served from our own origin, and
     cannot be mistaken for a photograph of anything.
     ------------------------------------------------------------------ */
  if (!url) return "/no-photo.svg";

  /* A stock URL already sitting in an old database row gets the same
     treatment, so rows written before this rule existed stop showing
     invented photographs without needing a data migration. */
  if (isStockPhoto(url)) return "/no-photo.svg";

  /* The loremflickr→picsum rewrite and the picsum downscaling branch that
     used to live here are both gone: neither host reaches this line any
     more. Their reason for existing (picsum served a 1200×700 original to
     paint a 528×308 tile, 274 KB of it waste) is settled more simply by not
     requesting a remote placeholder at all. */
  return optimizeImg(url, width);
}

/* ============================================================
 * Telling a real photograph from a decorative one.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * Every listing profile used to pad its gallery out to five or six
 * tiles with stock images — loremflickr keyword URLs picked from the
 * listing id. On a demo that reads as layout. On a real hotel with
 * one uploaded photo it reads as five photographs OF THAT HOTEL:
 * a bedroom nobody sleeps in, a restaurant that is not on site, a
 * view from a window that does not exist.
 *
 * A traveller choosing where to spend money in a valley they have
 * never visited cannot tell the difference, and the whole point of
 * the VERIFIED badge above the gallery is that they should not have
 * to. Padding is not a presentation choice here; it is a claim about
 * the property.
 *
 * So galleries now show exactly what the provider uploaded. One
 * photo means one photo.
 *
 * ---------------------------------------------------------------------------
 * WHY IT MATCHES ON HOST AND NOT ON A FLAG
 *
 * There is no column saying "this image is decorative" and adding
 * one would not help: the stock URLs are already saved in listing
 * rows by provider dashboards that filled a blank field with a
 * random picsum seed. The host is the only honest signal available
 * for rows that already exist, and it is exact — nobody uploads
 * their hotel to loremflickr.com.
 * ============================================================ */

/** Hosts that only ever serve decorative filler, never a provider's own photo. */
const STOCK_IMAGE_HOSTS = [
  "picsum.photos",
  "loremflickr.com",
  "placehold.co",
  "via.placeholder.com",
  "placekitten.com",
  "source.unsplash.com", // the random-photo endpoint, not images.unsplash.com
];

/** True when `url` is decorative filler rather than a real photograph. */
export function isStockPhoto(url?: string | null): boolean {
  if (!url) return false;
  return STOCK_IMAGE_HOSTS.some((h) => url.includes(h));
}

/**
 * The images a listing may honestly show: the cover first, then the
 * uploaded gallery, with filler and duplicates removed.
 *
 * Returns an empty array when a listing has no real photograph at all.
 * That is deliberate — ProfileGallery renders an honest "no photos yet"
 * panel for the empty case, which is information a traveller can act on.
 * A random picture of somebody else's lobby is not.
 */
export function realGallery(
  cover?: string | null,
  gallery?: string[] | null
): string[] {
  const all = [cover, ...(gallery ?? [])];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of all) {
    const url = typeof raw === "string" ? raw.trim() : "";
    if (!url || isStockPhoto(url)) continue;
    /* Deduped on the stored URL. The same photo saved as both the cover
       and the first gallery entry is one photo, and showing it twice
       makes a one-photo listing look like a two-photo listing. */
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
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
