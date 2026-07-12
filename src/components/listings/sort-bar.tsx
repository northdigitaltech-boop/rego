"use client";

import { cn } from "@/lib/utils";

export type SortId =
  | "featured"
  | "price-low"
  | "price-high"
  | "rating"
  | "reviews";

export const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "price-low", label: "Price: Low to High" },
  { id: "price-high", label: "Price: High to Low" },
  { id: "rating", label: "Top Rated" },
  { id: "reviews", label: "Most Reviewed" },
];

/** Shared sort tabs — matches the homepage. */
export function SortBar({
  value,
  onChange,
  className,
}: {
  value: SortId;
  onChange: (s: SortId) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar flex gap-2 overflow-x-auto pb-1", className)}>
      {SORT_OPTIONS.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all",
            value === s.id
              ? "bg-gradient-forest text-white shadow-soft"
              : "border border-border bg-card text-forest hover:border-forest/40"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** Generic sort over any item via an accessor returning sortable fields. */
export function sortItems<T>(
  items: T[],
  sort: SortId,
  get: (t: T) => {
    price: number;
    rating: number;
    reviews: number;
    featured?: boolean;
  }
): T[] {
  const arr = [...items];
  switch (sort) {
    case "price-low":
      arr.sort((a, b) => get(a).price - get(b).price);
      break;
    case "price-high":
      arr.sort((a, b) => get(b).price - get(a).price);
      break;
    case "rating":
      arr.sort(
        (a, b) => get(b).rating - get(a).rating || get(b).reviews - get(a).reviews
      );
      break;
    case "reviews":
      arr.sort((a, b) => get(b).reviews - get(a).reviews);
      break;
    default:
      arr.sort(
        (a, b) =>
          Number(!!get(b).featured) - Number(!!get(a).featured) ||
          get(b).rating - get(a).rating
      );
  }
  return arr;
}
