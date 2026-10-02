/* ============================================================
 * Which admin ranking badge may actually be shown.
 *
 * "Top Rated" is a claim about reviews. The badge is set by hand
 * in the admin, independently of any review, so a listing could
 * read "Top Rated" directly above "No reviews yet" — which is
 * what the live Skardu Explore Club page showed. A rating claim
 * with no ratings behind it is the kind of thing a traveller is
 * entitled to rely on and cannot check.
 *
 * So rating-type badges need at least one real review. The
 * editorial badges ("Editor's Choice", "Best Value", "New",
 * "Popular") are Rego's own judgement, are not presented as a
 * rating, and pass through unchanged. Nothing is deleted: the
 * admin value is kept, and the badge appears by itself once the
 * first review lands.
 * ============================================================ */

const RATING_CLAIM = /\b(top|highly|best|5[- ]?star)[\s-]*rated\b/i;

export function visibleRankingBadge(
  badge: string | null | undefined,
  reviewCount: number | null | undefined
): string {
  const b = (badge ?? "").trim();
  if (!b) return "";
  if (RATING_CLAIM.test(b) && !((reviewCount ?? 0) > 0)) return "";
  return b;
}
