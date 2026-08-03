import { Camera, MapPin } from "lucide-react";

import type { Attraction } from "@/lib/attractions";
import { photo } from "@/lib/utils";

/** "Top attractions" cards on a destination page. Renders nothing when empty. */
export function AttractionsSection({
  items,
  destinationName,
  fallbackImage,
}: {
  items: Attraction[];
  destinationName: string;
  fallbackImage?: string;
}) {
  if (!items.length) return null;

  return (
    <section className="container-px pt-10 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-700">
            <Camera className="h-3.5 w-3.5 text-gold" /> Must see
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold uppercase text-forest sm:text-3xl">
            Top attractions in {destinationName}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The places worth building your trip around — then book stays, tours and
            transport for them below.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((a, i) => (
          <article
            key={`${a.name}-${i}`}
            className="group overflow-hidden rounded-2xl border border-border bg-card shadow-premium transition-all hover:-translate-y-0.5 hover:shadow-premium-lg"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo(a.image || fallbackImage || "", 400)}
                alt={a.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest-900/75 to-transparent" />
              {a.type && (
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-forest backdrop-blur">
                  {a.type}
                </span>
              )}
              <h3 className="absolute inset-x-0 bottom-0 line-clamp-2 p-2.5 font-display text-sm font-bold leading-tight text-white">
                {a.name}
              </h3>
            </div>

            {a.blurb && (
              <p className="line-clamp-2 px-2.5 py-2 text-xs leading-snug text-muted-foreground">
                {a.blurb}
              </p>
            )}
          </article>
        ))}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-gold" />
        Distances and access vary by season — check road updates before you travel.
      </p>
    </section>
  );
}
