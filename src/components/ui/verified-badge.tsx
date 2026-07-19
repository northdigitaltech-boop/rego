import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Golden "verified" tick — a Facebook-style seal-check rendered in Rego's gold,
 * shown next to approved / Rego-verified property names.
 */
export function VerifiedBadge({
  className,
  title = "Verified by Rego",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <BadgeCheck
      role="img"
      aria-label={title}
      className={cn("inline-block shrink-0 fill-gold text-white align-middle", className)}
      strokeWidth={2.5}
    />
  );
}
