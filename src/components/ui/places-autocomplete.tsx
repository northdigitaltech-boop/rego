"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { MapPin, Loader2 } from "lucide-react";

interface Suggestion {
  name: string;
  full: string;
}

/**
 * Free place autocomplete via OpenStreetMap / Nominatim (no API key, no billing).
 * Restricted to Pakistan. Debounced to respect usage limits.
 */
export function PlacesAutocomplete({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=pk&limit=6&q=${encodeURIComponent(
            q
          )}`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        setSuggestions(
          (data as any[]).map((d) => ({
            name: d.name || String(d.display_name).split(",")[0],
            full: d.display_name,
          }))
        );
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={className}
        />
        {loading && (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[80vw] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-card">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s.name);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-forest-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-forest">
                    {s.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.full}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
