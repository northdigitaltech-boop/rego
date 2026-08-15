/* ============================================================
 * Photo rules for every listing category.
 *
 * Listings with one blurry photo don't get booked, and they make the whole
 * marketplace look thin. Five is the floor at which a place feels real;
 * twenty is where a gallery stops helping and starts being a slideshow
 * nobody finishes.
 * ============================================================ */

export const GALLERY_MIN = 5;
export const GALLERY_MAX = 20;

/**
 * Validation message for a gallery, or null when it's acceptable.
 * Used by provider dashboards before saving a listing.
 */
export function galleryError(urls: string[] | null | undefined): string | null {
  const n = (urls ?? []).filter(Boolean).length;
  if (n < GALLERY_MIN) {
    const missing = GALLERY_MIN - n;
    return `Please add at least ${GALLERY_MIN} photos — ${missing} more to go. Listings with more photos get noticeably more bookings.`;
  }
  if (n > GALLERY_MAX) {
    return `Please keep it to ${GALLERY_MAX} photos or fewer.`;
  }
  return null;
}

/** "3 of 5 minimum" / "12 of 20" — the live counter under the uploader. */
export function galleryCountLabel(count: number): string {
  if (count < GALLERY_MIN) return `${count} of ${GALLERY_MIN} minimum`;
  return `${count} of ${GALLERY_MAX}`;
}
