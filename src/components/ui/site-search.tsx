"use client";

import * as React from "react";
import { MapPin, Building2, Clock, TrendingUp, X } from "lucide-react";

import { listings, type Destination } from "@/lib/data";
import { getDestinations } from "@/lib/destinations";
import { getHotels } from "@/lib/hotels";
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  POPULAR_DESTINATIONS,
  type RecentSearch,
} from "@/lib/search-memory";
import { cn } from "@/lib/utils";

interface Item {
  label: string;
  sub: string;
  href: string;
  kind: "destination" | "listing" | "recent" | "popular";
}

export function SiteSearch({
  value,
  onChange,
  onPick,
  placeholder,
  className,
  service,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (href: string) => void;
  placeholder?: string;
  className?: string;
  /** Active service tab, stored alongside a recent search. */
  service?: string;
}) {
  const [dbHotels, setDbHotels] = React.useState<Item[]>([]);
  /* Real destinations, not the built-in list — that list's slugs (hunza,
     naran, deosai…) are not pages, so picking one opened a 404. */
  const [destinations, setDestinations] = React.useState<Destination[]>([]);
  const [open, setOpen] = React.useState(false);
  const [recent, setRecent] = React.useState<RecentSearch[]>([]);
  const [cursor, setCursor] = React.useState(-1);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    getHotels().then((hs) =>
      setDbHotels(
        hs.map((h) => ({
          label: h.title,
          sub: `Hotel · ${h.location}`,
          href: `/listings/${h.id}`,
          kind: "listing" as const,
        }))
      )
    );
    getDestinations().then(setDestinations).catch(() => {});
    setRecent(getRecentSearches());
  }, []);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const base: Item[] = React.useMemo(() => {
    const dests: Item[] = destinations.map((d) => ({
      label: d.name,
      /* No count here: this list is fetched without listings, and the
         typed `stays` text is not a real number. */
      sub: "Destination",
      href: `/destinations/${d.slug}`,
      kind: "destination",
    }));
    const statics: Item[] = listings.map((l) => ({
      label: l.title,
      sub: `${l.categoryLabel} · ${l.location}`,
      href: `/listings/${l.id}`,
      kind: "listing",
    }));
    const all = [...dests, ...dbHotels, ...statics];
    const seen = new Set<string>();
    return all.filter((it) =>
      seen.has(it.href) ? false : (seen.add(it.href), true)
    );
  }, [dbHotels, destinations]);

  const q = value.trim().toLowerCase();

  /* Typed → matches. Empty → recent searches, then popular destinations. */
  const results: Item[] = React.useMemo(() => {
    if (q.length > 0) {
      return base
        .filter(
          (it) =>
            it.label.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q)
        )
        .slice(0, 8);
    }
    const r: Item[] = recent.map((x) => ({
      label: x.label,
      sub: x.service ? `Recent · ${x.service}` : "Recent search",
      href: x.href ?? "",
      kind: "recent",
    }));
    const seen = new Set(r.map((x) => x.label.toLowerCase()));
    const p: Item[] = POPULAR_DESTINATIONS.filter(
      (d) => !seen.has(d.label.toLowerCase())
    ).map((d) => ({
      label: d.label,
      sub: "Popular in Gilgit-Baltistan",
      href: d.href,
      kind: "popular",
    }));
    return [...r, ...p].slice(0, 8);
  }, [q, base, recent]);

  React.useEffect(() => setCursor(-1), [q, open]);

  const choose = (it: Item) => {
    onChange(it.label);
    setOpen(false);
    addRecentSearch({ label: it.label, href: it.href || undefined, service });
    setRecent(getRecentSearches());
    if (it.href) onPick(it.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c <= 0 ? results.length - 1 : c - 1));
    } else if (e.key === "Enter" && cursor >= 0) {
      e.preventDefault();
      choose(results[cursor]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showingMemory = q.length === 0 && results.length > 0;

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          /* A placeholder is not an accessible name — screen readers need this. */
          aria-label={placeholder || "Search"}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="site-search-list"
          className={className}
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange("");
              onPick("");
              setOpen(true);
            }}
            aria-label="Clear destination"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-forest"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id="site-search-list"
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[80vw] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-card"
        >
          {showingMemory && recent.length > 0 && (
            <li className="flex items-center justify-between px-3 py-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Recent
              </span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  clearRecentSearches();
                  setRecent([]);
                }}
                className="text-[11px] font-semibold text-forest-600 hover:text-gold"
              >
                Clear
              </button>
            </li>
          )}

          {results.map((it, i) => (
            <li key={`${it.kind}-${it.label}-${i}`} role="option" aria-selected={cursor === i}>
              <div
                className={cn(
                  "group flex items-center",
                  cursor === i && "bg-forest-50"
                )}
              >
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(it);
                  }}
                  onMouseEnter={() => setCursor(i)}
                  className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left hover:bg-forest-50"
                >
                  {it.kind === "recent" ? (
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : it.kind === "popular" ? (
                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  ) : it.kind === "destination" ? (
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
                  ) : (
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-forest">
                      {it.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {it.sub}
                    </span>
                  </span>
                </button>

                {it.kind === "recent" && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      removeRecentSearch(it.label);
                      setRecent(getRecentSearches());
                    }}
                    aria-label={`Remove ${it.label} from recent searches`}
                    className="mr-2 grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-forest group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </li>
          ))}

          {showingMemory && (
            <li className="border-t border-border px-3 py-1.5">
              <span className="text-[11px] text-muted-foreground">
                Start typing to search hotels, tours and guides
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
