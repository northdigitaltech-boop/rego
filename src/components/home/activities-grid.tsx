import Link from "next/link";
import { ChevronRight, Star, MapPin, Clock, BadgeCheck } from "lucide-react";

import { activityCategoryName, type ActivityRow } from "@/lib/activities";
import { Reveal } from "@/components/ui/reveal";
import { photo, formatPrice } from "@/lib/utils";

/** Homepage Activities section — real approved activities. */
export function ActivitiesGrid({ items }: { items: ActivityRow[] }) {
  if (!items || items.length === 0) return null;
  const shown = items.slice(0, 4);
  const cols = "lg:grid-cols-4";
  return (
    <section className="bg-background py-12 sm:py-16">
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">
              Activities &amp; Adventures
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Treks, safaris, boating and more across Gilgit-Baltistan.</p>
          </div>
          <Link href="/activities" className="group inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
            View All Activities
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
        <div className={`grid grid-cols-2 gap-3 sm:gap-5 ${cols}`}>
          {shown.map((a) => (
            <Link
              key={a.id}
              href={`/activities/${a.id}`}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2"
            >
              <div className="relative h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo(a.image || "https://picsum.photos/seed/activity/900/600")} alt={a.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-600 backdrop-blur">
                  {activityCategoryName(a.category)}
                </span>
                {a.verified && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-forest-600 backdrop-blur">
                    <BadgeCheck className="h-3 w-3 text-gold" /> Verified
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-base font-semibold leading-snug text-forest">{a.title}</h3>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                  <span className="font-semibold text-forest">{Number(a.rating).toFixed(1)}</span>
                  <span className="ml-auto flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {a.location || a.city || "GB"}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {a.duration && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {a.duration}</span>}
                  <span className="ml-auto font-display text-sm font-bold text-forest">{a.price > 0 ? formatPrice(a.price) : "Enquire"}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
