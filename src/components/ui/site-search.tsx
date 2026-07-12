"use client";

import * as React from "react";
import { MapPin, Building2 } from "lucide-react";

import { destinations, listings } from "@/lib/data";
import { getHotels } from "@/lib/hotels";

interface Item {
  label: string;
  sub: string;
  href: string;
  kind: "destination" | "listing";
}

export function SiteSearch({
  value,
  onChange,
  onPick,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (href: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [dbHotels, setDbHotels] = React.useState<Item[]>([]);
  const [open, setOpen] = React.useState(false);
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
      sub: `Destination · ${d.stays}`,
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
    // de-dupe by href
    const seen = new Set<string>();
    return all.filter((it) =>
      seen.has(it.href) ? false : (seen.add(it.href), true)
    );
  }, [dbHotels]);

  const q = value.trim().toLowerCase();
  const results =
    q.length === 0
      ? []
      : base
          .filter(
            (it) =>
              it.label.toLowerCase().includes(q) ||
              it.sub.toLowerCase().includes(q)
          )
          .slice(0, 8);

  return (
    <div ref={boxRef} className="relative w-full">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[80vw] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-card">
          {results.map((it, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(it.label);
                  setOpen(false);
                  onPick(it.href);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-forest-50"
              >
                {it.kind === "destination" ? (
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
