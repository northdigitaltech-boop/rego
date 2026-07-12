"use client";

import * as React from "react";
import { Database, Search, X } from "lucide-react";

import { ListingCard } from "@/components/home/listing-card";
import { SortBar, sortItems, type SortId } from "@/components/listings/sort-bar";
import { type Listing } from "@/lib/data";

export function HotelCategoryView({
  hotels,
  heading,
  subheading,
  query = "",
}: {
  hotels: Listing[];
  heading: string;
  subheading: string;
  query?: string;
}) {
  const [sort, setSort] = React.useState<SortId>("featured");
  const [q, setQ] = React.useState(query);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? hotels.filter(
          (l) =>
            l.location.toLowerCase().includes(needle) ||
            l.title.toLowerCase().includes(needle) ||
            (l.provider ?? "").toLowerCase().includes(needle)
        )
      : hotels;
    return sortItems(base, sort, (l) => ({
      price: l.price,
      rating: l.rating,
      reviews: l.reviews,
      featured: l.featured,
    }));
  }, [hotels, sort, q]);

  return (
    <div className="bg-background">
      <div className="border-b border-border bg-forest-50/50">
        <div className="container-px py-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">
              {heading}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white">
              <Database className="h-3.5 w-3.5" /> Live from database
            </span>
          </div>
          <p className="mt-2 text-muted-foreground">{subheading}</p>

          {/* Search within this category */}
          <div className="mt-4 flex max-w-md items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 shadow-premium">
            <Search className="h-5 w-5 text-forest-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${heading.toLowerCase()} by name or location…`}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear" className="text-muted-foreground hover:text-forest">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
            {q.trim() ? ` for “${q.trim()}”` : " available"}
          </p>
          <SortBar value={sort} onChange={setSort} className="mt-4" />
        </div>
      </div>

      <div className="container-px py-8">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center text-muted-foreground">
            No results for “{q.trim()}”. Try a different destination or clear the search.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((l, i) => (
              <ListingCard key={l.id} listing={l} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
