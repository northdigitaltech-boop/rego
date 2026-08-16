/* ============================================================
 * Listing badges.
 *
 * Every badge here is EARNED from a real field. Nothing is
 * decorative and nothing is assigned at random, because a badge
 * that does not mean anything quietly devalues the ones that do —
 * if "Top rated" appears on everything, travellers stop reading it.
 *
 * The thresholds are deliberately conservative:
 *
 *   "Top rated" requires a MINIMUM NUMBER OF REVIEWS, not just a
 *   high score. One five-star review from a friend produces a
 *   perfect average, and badging that as top rated would mislead
 *   a traveller who is about to spend real money in a remote
 *   valley on the strength of it.
 *
 *   "New" EXPIRES. A listing that has been up for a year is not
 *   new, and a permanent "New" tag is just a lie with a deadline
 *   nobody set.
 *
 * Used across every category. Add a badge here, not in a card.
 * ============================================================ */

export type BadgeTone = "gold" | "forest" | "sky" | "plain";

export interface ListingBadge {
  id: string;
  label: string;
  tone: BadgeTone;
  /** Shown as a tooltip — every badge can explain itself. */
  title: string;
}

/* ---- thresholds, in one place so they can be argued with ---- */

/** A score below this is not "top rated", whatever the average says. */
export const TOP_RATED_MIN_SCORE = 4.5;
/** And it needs enough reviews for the average to mean anything. */
export const TOP_RATED_MIN_REVIEWS = 5;

export const HIGHLY_RATED_MIN_SCORE = 4.0;
export const HIGHLY_RATED_MIN_REVIEWS = 3;

/** After this many days a listing stops being new. */
export const NEW_WINDOW_DAYS = 30;

/** Years of experience that earns the badge. */
export const EXPERIENCED_MIN_YEARS = 5;

/** More than this on one card is clutter, and clutter reads as spam. */
export const MAX_BADGES = 2;

export interface BadgeInput {
  rating?: number | null;
  reviews?: number | null;
  createdAt?: string | null;
  featured?: boolean | null;
  experienceYears?: number | null;
  /** Bookings completed, when the category tracks it. */
  bookings?: number | null;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 86_400_000;
}

/**
 * Work out which badges a listing has earned.
 *
 * Order matters — the strongest signal comes first, and the list is
 * capped, so a listing that qualifies for several shows the most
 * meaningful ones rather than all of them.
 */
export function listingBadges(input: BadgeInput): ListingBadge[] {
  const out: ListingBadge[] = [];

  const rating = Number(input.rating ?? 0);
  const reviews = Number(input.reviews ?? 0);
  const age = daysSince(input.createdAt);

  // 1. Admin-curated. Highest signal because a person chose it.
  if (input.featured) {
    out.push({
      id: "featured",
      label: "Featured",
      tone: "gold",
      title: "Selected by the Rego team",
    });
  }

  // 2. Earned from reviews. Score AND count, never score alone.
  if (rating >= TOP_RATED_MIN_SCORE && reviews >= TOP_RATED_MIN_REVIEWS) {
    out.push({
      id: "top-rated",
      label: "Top rated",
      tone: "gold",
      title: `${rating.toFixed(1)} from ${reviews} reviews`,
    });
  } else if (rating >= HIGHLY_RATED_MIN_SCORE && reviews >= HIGHLY_RATED_MIN_REVIEWS) {
    out.push({
      id: "highly-rated",
      label: "Highly rated",
      tone: "forest",
      title: `${rating.toFixed(1)} from ${reviews} reviews`,
    });
  }

  // 3. Experience, where the category records it.
  const years = Number(input.experienceYears ?? 0);
  if (years >= EXPERIENCED_MIN_YEARS) {
    out.push({
      id: "experienced",
      label: `${years}+ yrs`,
      tone: "forest",
      title: `${years} years of experience`,
    });
  }

  /* 4. New — last, and only when there is nothing better to say.
        A listing with real reviews has earned a better badge than
        "New", and showing both is contradictory. It also expires. */
  if (
    out.length === 0 &&
    age !== null &&
    age <= NEW_WINDOW_DAYS &&
    reviews === 0
  ) {
    out.push({
      id: "new",
      label: "New",
      tone: "sky",
      title: `Joined Rego in the last ${NEW_WINDOW_DAYS} days`,
    });
  }

  return out.slice(0, MAX_BADGES);
}

/** Tailwind classes per tone, so cards stay visually consistent. */
export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  gold: "bg-gold-50 text-gold-700 border-gold-300",
  forest: "bg-forest-50 text-forest-700 border-forest-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  plain: "bg-muted text-muted-foreground border-border",
};
