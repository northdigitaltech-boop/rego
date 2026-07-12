import * as React from "react";
import { SearchX } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * EmptyState — a friendly, on-brand placeholder for "no results / nothing here
 * yet" screens (empty listings, filtered-to-zero, empty saved lists, etc.).
 */
export function EmptyState({
  icon,
  title = "Nothing here yet",
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "mx-auto flex max-w-md flex-col items-center rounded-3xl border border-border/70 bg-card px-6 py-12 text-center shadow-soft",
        className
      )}
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-forest-50 text-forest-600 [&>svg]:h-7 [&>svg]:w-7">
        {icon ?? <SearchX />}
      </span>
      <h3 className="mt-4 font-display text-lg font-bold text-forest">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
