"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { SlidersHorizontal, X, Search } from "lucide-react";

import { ServiceCard } from "@/components/home/service-cards";
import { Button } from "@/components/ui/button";
import { SortBar, sortItems, type SortId } from "@/components/listings/sort-bar";
import {
  categoryGroups,
  listings,
  locations,
  type CategorySlug,
} from "@/lib/data";
import { cn, formatPrice } from "@/lib/utils";

const PRICE_MAX = 60000;

interface ListingsBrowserProps {
  initialCategory?: CategorySlug;
  initialLocation?: string;
  heading?: string;
  subheading?: string;
  hideHeader?: boolean;
}

export function ListingsBrowser({
  initialCategory: propCategory,
  initialLocation: propLocation,
  heading = "Explore Listings",
  subheading = "Hotels, tours, transport, guides and more across Gilgit Baltistan.",
  hideHeader = false,
}: ListingsBrowserProps = {}) {
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const queryCategory = (params.get("category") as CategorySlug | null) ?? undefined;
  const queryLocation = params.get("location") ?? undefined;

  const [category, setCategory] = React.useState<CategorySlug | "all">(
    propCategory ?? queryCategory ?? "all"
  );
  const [location, setLocation] = React.useState<string>(
    propLocation ?? queryLocation ?? "all"
  );
  const [maxPrice, setMaxPrice] = React.useState(PRICE_MAX);
  const [minRating, setMinRating] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortId>("featured");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // Keep the category in sync when it's changed via the URL (e.g. the quick
  // filter chips in a destination hero link to ?category=hotels).
  React.useEffect(() => {
    if (!propCategory) setCategory(queryCategory ?? "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryCategory]);

  const results = React.useMemo(() => {
    const list = listings.filter((l) => {
      if (category !== "all" && l.category !== category) return false;
      if (location !== "all") {
        const a = l.location.toLowerCase();
        const b = location.toLowerCase();
        if (!a.includes(b) && !b.includes(a)) return false;
      }
      if (l.price > maxPrice) return false;
      if (l.rating < minRating) return false;
      if (query && !l.title.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
    return sortItems(list, sort, (l) => ({
      price: l.price,
      rating: l.rating,
      reviews: l.reviews,
      featured: l.featured,
    }));
  }, [category, location, maxPrice, minRating, query, sort]);

  const resetFilters = () => {
    setCategory("all");
    setLocation("all");
    setMaxPrice(PRICE_MAX);
    setMinRating(0);
    setQuery("");
  };

  // Close the mobile filter drawer with the Escape key (accessibility).
  React.useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFiltersOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  // Readable category name for the applied-filter chips.
  const categoryName =
    category === "all"
      ? null
      : categoryGroups.flatMap((g) => g.items).find((c) => c.slug === category)?.name ?? category;

  // Active filters summary (presentational — uses existing setters only).
  const activeChips: { key: string; label: string; clear: () => void }[] = [
    ...(categoryName ? [{ key: "cat", label: categoryName, clear: () => setCategory("all") }] : []),
    ...(location !== "all" ? [{ key: "loc", label: location, clear: () => setLocation("all") }] : []),
    ...(minRating > 0 ? [{ key: "rat", label: `${minRating}+ rating`, clear: () => setMinRating(0) }] : []),
    ...(maxPrice < PRICE_MAX ? [{ key: "prc", label: `Up to ${formatPrice(maxPrice)}`, clear: () => setMaxPrice(PRICE_MAX) }] : []),
    ...(query ? [{ key: "q", label: `“${query}”`, clear: () => setQuery("") }] : []),
  ];

  const FilterPanel = (
    <div className="space-y-7">
      <div>
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-forest">
          Max price
        </h3>
        <input
          type="range"
          min={2000}
          max={PRICE_MAX}
          step={1000}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full accent-forest-600"
        />
        <p className="mt-1 text-sm text-muted-foreground">
          Up to <span className="font-semibold text-forest">{formatPrice(maxPrice)}</span>
        </p>
      </div>

      <div>
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-forest">
          Minimum rating
        </h3>
        <div className="flex flex-wrap gap-2">
          {[0, 4, 4.5, 4.8].map((r) => (
            <Chip
              key={r}
              label={r === 0 ? "Any" : `${r}+`}
              active={minRating === r}
              onClick={() => setMinRating(r)}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-forest">
          Category
        </h3>
        <div className="space-y-1">
          <FilterRadio
            label="All categories"
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
        </div>
        <div className="mt-3 space-y-4">
          {categoryGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((c) => (
                  <FilterRadio
                    key={c.slug}
                    label={c.name}
                    active={category === c.slug}
                    onClick={() => setCategory(c.slug)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-forest">
          Location
        </h3>
        <div className="flex flex-wrap gap-2">
          <Chip
            label="All"
            active={location === "all"}
            onClick={() => setLocation("all")}
          />
          {locations.map((loc) => (
            <Chip
              key={loc}
              label={loc}
              active={location === loc}
              onClick={() => setLocation(loc)}
            />
          ))}
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={resetFilters}>
        Reset filters
      </Button>
    </div>
  );

  return (
    <div className="bg-background">
      {/* Page header */}
      {!hideHeader && (
        <div className="border-b border-border bg-forest-50/50">
          <div className="container-px py-8">
            <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">
              {heading}
            </h1>
            <p className="mt-2 text-muted-foreground">{subheading}</p>

            <div className="mt-5 flex max-w-xl items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 shadow-premium focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/25">
              <Search className="h-5 w-5 text-forest-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${heading.toLowerCase()} by name…`}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <SortBar value={sort} onChange={setSort} className="mt-4" />
          </div>
        </div>
      )}

      <div className="container-px py-8">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
              {FilterPanel}
            </div>
          </aside>

          {/* Results */}
          <div>
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-forest">{results.length}</span>{" "}
                {results.length === 1 ? "result" : "results"}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFiltersOpen(true)}
                  aria-label="Open filters"
                  className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-forest transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 lg:hidden"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeChips.length > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-forest-600 px-1 text-[11px] font-bold text-white">
                      {activeChips.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Applied-filter chips */}
            {activeChips.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {activeChips.map((c) => (
                  <button
                    key={c.key}
                    onClick={c.clear}
                    className="inline-flex items-center gap-1.5 rounded-full border border-forest/20 bg-forest-50 px-3 py-1 text-xs font-semibold text-forest transition-colors hover:bg-forest-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                  >
                    {c.label}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
                <button
                  onClick={resetFilters}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-forest-600 underline-offset-2 transition-colors hover:text-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                >
                  Clear all
                </button>
              </div>
            )}

            {results.length > 0 ? (
              <motion.div
                layout={!reduce}
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
              >
                {results.map((listing, i) => (
                  <ServiceCard key={listing.id} listing={listing} index={i} />
                ))}
              </motion.div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-20 text-center">
                <p className="font-display text-lg font-semibold text-forest">
                  No listings match your filters
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try widening your price range or clearing some filters.
                </p>
                <Button variant="gold" className="mt-5" onClick={resetFilters}>
                  Reset filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div
            className="absolute inset-0 bg-forest-900/50"
            onClick={() => setFiltersOpen(false)}
          />
          <motion.div
            initial={reduce ? { x: 0 } : { x: "-100%" }}
            animate={{ x: 0 }}
            transition={reduce ? { duration: 0 } : { type: "tween", duration: 0.3 }}
            className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-white p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-forest">Filters</h2>
              <button
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
                className="grid h-9 w-9 place-items-center rounded-full text-forest transition-colors hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {FilterPanel}
            <Button
              variant="gold"
              className="mt-6 w-full"
              onClick={() => setFiltersOpen(false)}
            >
              Show {results.length} results
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function FilterRadio({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
        active ? "bg-forest-50 font-semibold text-forest" : "font-medium text-forest hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
          active ? "border-forest-600" : "border-border"
        )}
      >
        {active && <span className="h-2 w-2 rounded-full bg-forest-600" />}
      </span>
      {label}
    </button>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
        active
          ? "bg-forest-600 text-white"
          : "border border-border bg-white text-forest hover:border-forest/40"
      )}
    >
      {label}
    </button>
  );
}
