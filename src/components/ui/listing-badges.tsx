import { cn } from "@/lib/utils";
import {
  listingBadges,
  BADGE_TONE_CLASS,
  type BadgeInput,
} from "@/lib/listing-badges";

/* ============================================================
 * Renders the badges a listing has earned.
 *
 * Renders NOTHING when none are earned — no "Standard" filler,
 * no grey placeholder. An empty row is the honest answer for a
 * listing that has not distinguished itself yet, and it keeps
 * the badges that do appear worth noticing.
 * ============================================================ */

export function ListingBadges({
  className,
  size = "sm",
  ...input
}: BadgeInput & { className?: string; size?: "sm" | "xs" }) {
  const badges = listingBadges(input);
  if (badges.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {badges.map((b) => (
        <span
          key={b.id}
          title={b.title}
          className={cn(
            "inline-flex items-center rounded-full border font-bold uppercase tracking-wide",
            size === "xs"
              ? "px-1.5 py-0.5 text-[9px]"
              : "px-2 py-0.5 text-[10px]",
            BADGE_TONE_CLASS[b.tone]
          )}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
