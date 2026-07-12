import * as React from "react";

import { cn } from "@/lib/utils";

/** Base shimmer block. Reuse for any loading placeholder. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-forest-100/70", className)}
    />
  );
}

/**
 * SkeletonCard — a placeholder that matches the ListingCard shape so grids and
 * carousels reserve space (no layout shift) while data loads.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft",
        className
      )}
    >
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-end justify-between pt-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** A row/grid of skeleton cards. */
export function SkeletonCardGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
