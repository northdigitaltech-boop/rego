import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { Destination } from "@/lib/data";
import { photo } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";


/* The list now arrives from the server (app/page.tsx calls getDestinations()).
   It used to start from the built-in list and swap in the real one after
   hydration — so the HTML a search engine read carried the built-in list:
   links to /destinations/hunza, /naran, /deosai (all 404) and invented
   "120+ Stays" counts. Now the first HTML is the real list. */
export function Destinations({ initial }: { initial: Destination[] }) {
  const destinations = initial;
  if (destinations.length === 0) return null;

  return (
    <section id="destinations" className="bg-background py-12 sm:py-16">
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">
            Popular Destinations
          </h2>
          <Link
            prefetch={false}
            href="/destinations"
            className="group inline-flex items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            View All Destinations
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {destinations.slice(0, 4).map((d, i) => (
            <Reveal key={d.slug} index={i}>
              <Link
              prefetch={false}
              href={`/destinations/${d.slug}`}
              className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1 group relative block h-44 overflow-hidden rounded-3xl shadow-premium ring-1 ring-black/5 transition-shadow hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 sm:h-48"
              >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
              src={photo(d.image, 500)}
              alt={`${d.name}, Gilgit-Baltistan`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest-900/90 via-forest-900/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
              {/* Same bottom-anchored overlay as the service cards: without a
                  clamp a long name grows upward out of the tile. Destination
                  names are admin-entered and short today, so this is a guard
                  rather than a fix for something visibly broken. */}
              <h3 className="line-clamp-2 font-display text-lg font-bold text-white">
              {d.name}
              </h3>
              {d.stays && (
              <p className="mt-0.5 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
              {d.stays}
              </p>
              )}
              </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
