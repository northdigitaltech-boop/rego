import Link from "next/link";
import { BadgeCheck, ChevronRight, MapPin, Mountain } from "lucide-react";

import { Reveal } from "@/components/ui/reveal";
import { Rating } from "@/components/ui/rating";
import { photo, formatPrice } from "@/lib/utils";
import { type ExpeditionCard } from "@/lib/home-feed";

/* Homepage Mountaineering & Expeditions section.
 *
 * Sits after Activities & Adventures, because an expedition is the same
 * impulse one step further and the two read as a pair.
 *
 * Companies and individual professionals appear together, as they do on
 * /expeditions. The badge says which, and the link goes to the right detail
 * route — the normalising is done in feedExpeditions() so this file has one
 * shape to draw.
 *
 * Renders nothing when nothing is approved. An empty section with a heading
 * would advertise a category Rego cannot yet serve. */
export function ExpeditionsGrid({ items }: { items: ExpeditionCard[] }) {
  if (!items || items.length === 0) return null;
  const shown = items.slice(0, 4);

  return (
    <section className="bg-background py-12 sm:py-16">
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">
              Mountaineering &amp; Expeditions
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Expedition companies, guides, high-altitude porters and camp staff
              across Gilgit-Baltistan.
            </p>
          </div>
          <Link
            prefetch={false}
            href="/expeditions"
            className="group inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            View All Expeditions
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {shown.map((e) => (
            <Link
              prefetch={false}
              key={`${e.kind}:${e.id}`}
              href={e.href}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2"
            >
              <div className="relative h-40 overflow-hidden">
                {e.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photo(e.image, 500)}
                    alt={e.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  /* No stock photo standing in for a real one — a plain panel
                     is honest about there being no picture yet. */
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <Mountain className="h-8 w-8 text-forest-600/40" />
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-600 backdrop-blur">
                  {e.kind === "company" ? "Company" : "Professional"}
                </span>
                {e.verified && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-forest-600 backdrop-blur">
                    <BadgeCheck className="h-3 w-3 text-gold" /> Verified
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-base font-semibold leading-snug text-forest">
                  {e.name}
                </h3>

                {(e.location || e.yearsExperience) && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {[
                        e.location,
                        e.yearsExperience ? `${e.yearsExperience} yrs` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                )}

                {e.detail && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {e.kind === "company" ? `Peaks: ${e.detail}` : e.detail}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                  <Rating value={e.rating} reviews={e.reviews} />
                  <span className="font-display text-sm font-bold text-forest">
                    {e.startingPrice && e.startingPrice > 0
                      ? formatPrice(e.startingPrice)
                      : "Request quote"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
