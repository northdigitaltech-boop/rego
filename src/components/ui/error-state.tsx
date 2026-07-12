import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * ErrorState — an on-brand panel for recoverable failures (a fetch failed, a
 * section couldn't load). Keeps destructive-red reserved for the icon only, and
 * offers a clear retry action.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Please try again in a moment.",
  action,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "mx-auto flex max-w-md flex-col items-center rounded-3xl border border-red-100 bg-red-50/60 px-6 py-12 text-center",
        className
      )}
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-red-500 shadow-soft [&>svg]:h-7 [&>svg]:w-7">
        <TriangleAlert />
      </span>
      <h3 className="mt-4 font-display text-lg font-bold text-forest">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
