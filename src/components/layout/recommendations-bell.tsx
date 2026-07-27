"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, MapPin, Star, ArrowRight } from "lucide-react";

import { photo, formatPrice, cn } from "@/lib/utils";

interface RecItem {
  id: string;
  title: string;
  categoryLabel: string;
  location: string;
  rating: number;
  price: number;
  unit: string;
  image: string;
  href: string;
}

const SEEN_KEY = "rego_reco_seen";

/** Read the set of recommendation IDs the user has already seen. */
function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * "Recommended for you" bell — shows top-rated & newest verified listings to
 * everyone (no login needed). A gold dot appears when there are picks the user
 * hasn't opened this dropdown for yet; opening it marks them seen.
 */
export function RecommendationsBell({
  className,
  triggerClass = "text-forest/80 hover:text-forest-600",
}: {
  className?: string;
  triggerClass?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<RecItem[]>([]);
  const [unseen, setUnseen] = React.useState(0);

  // Fetch once on mount (cached server-side for everyone).
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/recommendations");
        const data = await res.json();
        if (!active || !data?.ok) return;
        const list: RecItem[] = data.items ?? [];
        setItems(list);
        const seen = readSeen();
        setUnseen(list.filter((i) => !seen.has(i.id)).length);
      } catch {
        /* ignore — bell just stays empty */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Opening the dropdown marks the current picks as seen.
  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next && items.length > 0) {
        try {
          localStorage.setItem(SEEN_KEY, JSON.stringify(items.map((i) => i.id)));
        } catch {
          /* ignore */
        }
        setUnseen(0);
      }
      return next;
    });
  };

  if (items.length === 0) return null;

  return (
    <div className={cn("relative flex items-center", className)}>
      <button
        onClick={toggle}
        aria-label="Recommended for you"
        title="Recommended for you"
        className={cn("relative flex items-center transition-colors", triggerClass)}
      >
        <Sparkles className="h-5 w-5" />
        {unseen > 0 && (
          <span className="absolute -right-2 -top-2 grid h-4 min-w-[16px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-forest-900">
            {unseen}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-border/70 bg-white text-left shadow-premium-lg">
            <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-forest-50 to-gold/10 px-4 py-3">
              <Sparkles className="h-4 w-4 text-gold" />
              <p className="font-display text-sm font-bold text-forest">Recommended for you</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.map((r) => (
                <Link
                  key={r.id}
                  href={r.href}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 border-b border-border px-3 py-2.5 transition-colors last:border-0 hover:bg-muted/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo(r.image, 120)}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-forest-600">
                      {r.categoryLabel}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block font-display text-sm font-bold text-forest">
                      {r.title}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" /> {r.location}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-gold text-gold" /> {r.rating.toFixed(1)}
                      </span>
                    </span>
                    {r.price > 0 && (
                      <span className="block text-xs font-bold text-forest">
                        {formatPrice(r.price)}
                        <span className="text-[10px] font-normal text-muted-foreground">/{r.unit}</span>
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
            <Link
              href="/listings"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-forest-600 hover:bg-muted/50"
            >
              Browse all listings <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
