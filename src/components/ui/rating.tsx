import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/* ============================================================
 * Rating display.
 *
 * A listing with no reviews has a rating of 0. Printing "0.0" next to a
 * gold star reads as "rated zero out of five" — actively worse than
 * showing nothing. Everywhere a rating appears, use this instead.
 * ============================================================ */

/** True when there is a real, review-backed score to show. */
export function hasRating(value: unknown, reviews?: number | null): boolean {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (reviews != null && Number(reviews) <= 0) return false;
  return true;
}

export function Rating({
  value,
  reviews,
  showCount = false,
  /** Shown when nothing has been rated yet. Pass null to render nothing. */
  emptyLabel = "No reviews yet",
  className,
  starClass = "h-3.5 w-3.5",
}: {
  value: number | string | null | undefined;
  reviews?: number | null;
  showCount?: boolean;
  emptyLabel?: string | null;
  className?: string;
  starClass?: string;
}) {
  if (!hasRating(value, reviews)) {
    if (emptyLabel === null) return null;
    return (
      <span
        className={cn(
          "rounded-full bg-forest-50 px-2 py-0.5 text-xs font-semibold text-forest-700",
          className
        )}
      >
        {emptyLabel}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Star className={cn("fill-gold text-gold", starClass)} />
      <span className="font-semibold text-forest">{Number(value).toFixed(1)}</span>
      {showCount && reviews != null && Number(reviews) > 0 && (
        <span className="text-muted-foreground">({reviews})</span>
      )}
    </span>
  );
}
