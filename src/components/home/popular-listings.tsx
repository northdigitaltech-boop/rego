"use client";

import * as React from "react";

import { ListingCard } from "@/components/home/listing-card";
import { listings, type Listing } from "@/lib/data";
import { cn } from "@/lib/utils";

const SORTS: { id: string; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "price-low", label: "Price: Low to High" },
  { id: "price-high", label: "Price: High to Low" },
  { id: "rating", label: "Top Rated" },
  { id: "reviews", label: "Most Reviewed" },
];

function sortListings(sort: string): Listing[] {
  const arr = [...listings];
  switch (sort) {
    case "price-low":
      arr.sort((a, b) => a.price - b.price);
      break;
    case "price-high":
      arr.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      arr.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
      break;
    case "reviews":
      arr.sort((a, b) => b.reviews - a.reviews);
      break;
    default:
      // Featured first, then by rating.
      arr.sort(
        (a, b) =>
          Number(!!b.featured) - Number(!!a.featured) || b.rating - a.rating
      );
  }
  return arr.slice(0, 8);
}

export function PopularListings() {
  const [sort, setSort] = React.useState("featured");
  const items = React.useMemo(() => sortListings(sort), [sort]);

  return (
    <section className="bg-background py-10 sm:py-12">
      <div className="container-px">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-forest sm:text-3xl">
              Explore stays &amp; experiences
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sort by price, rating and popularity to find your perfect match.
            </p>
          </div>
          <a
            href="/listings"
            className="text-sm font-semibold text-forest-600 transition-colors hover:text-gold"
          >
            View all →
          </a>
        </div>

        {/* Sort tabs */}
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                sort === s.id
                  ? "bg-gradient-forest text-white shadow-soft"
                  : "border border-border bg-card text-forest hover:border-forest/40"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
