"use client";

import * as React from "react";
import { Loader2, MapPin, Plane, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { searchAirports } from "@/lib/flights/airports";
import type { Airport } from "@/lib/flights/types";

/* ============================================================
 * Airport picker.
 *
 * Debounced at 250ms and every in-flight request is aborted when
 * the next keystroke arrives. Without that, typing "islamabad"
 * fires nine queries and the answer to "isl" can land after the
 * answer to "islamabad" and overwrite it — the classic
 * out-of-order autocomplete bug, which looks like the component
 * ignoring what you typed.
 *
 * Nothing is loaded up front. The airports table is thousands of
 * rows; shipping it to a phone to save one 40ms query is the wrong
 * trade on the connections REGO's users actually have.
 * ============================================================ */

export function AirportAutocomplete({
  label,
  value,
  onChange,
  placeholder = "City or airport",
  excludeCode,
  id,
}: {
  label: string;
  value: Airport | null;
  onChange: (airport: Airport | null) => void;
  placeholder?: string;
  /** The other field's airport — you cannot fly somewhere from itself. */
  excludeCode?: string | null;
  id?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Airport[]>([]);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);

  const boxRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  /* ---- debounced lookup ---- */
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setBusy(false);
      return;
    }

    setBusy(true);
    const timer = setTimeout(async () => {
      /* Supabase's client does not take a signal, so the guard is a flag:
         a stale response is discarded rather than rendered. */
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const found = await searchAirports(q, 8);
      if (controller.signal.aborted) return;

      setResults(excludeCode ? found.filter((a) => a.iataCode !== excludeCode) : found);
      setHighlight(0);
      setBusy(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, excludeCode]);

  /* ---- close on outside click ---- */
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (a: Airport) => {
    onChange(a);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </label>

      {value ? (
        /* Once chosen, show the airport rather than the raw text — the code is
           what the airline cares about and what the traveller should verify. */
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(true);
            setQuery("");
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:bg-muted"
        >
          <Plane className="h-4 w-4 shrink-0 text-forest-600" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-forest">
              {value.city} <span className="text-forest-600">({value.iataCode})</span>
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {value.airportName}
            </span>
          </span>
          <X className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <div className="relative">
          <input
            id={id}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={id ? `${id}-list` : undefined}
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-forest placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-forest-600"
          />
          {busy && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {open && !value && query.trim().length >= 2 && (
        <ul
          id={id ? `${id}-list` : undefined}
          role="listbox"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-border bg-card shadow-premium-lg"
        >
          {results.length === 0 && !busy ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No airports match &ldquo;{query.trim()}&rdquo;.
            </li>
          ) : (
            results.map((a, i) => (
              <li key={a.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(a)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-2.5 text-left",
                    i === highlight ? "bg-muted" : "hover:bg-muted/60"
                  )}
                >
                  <span className="mt-0.5 grid h-8 w-10 shrink-0 place-items-center rounded-lg bg-forest-50 text-xs font-bold text-forest-600">
                    {a.iataCode}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-forest">
                      {a.airportName}
                    </span>
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {a.city}, {a.country}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
