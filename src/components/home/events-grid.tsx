import Link from "next/link";
import { ChevronRight, CalendarDays, MapPin, Ticket } from "lucide-react";

import { eventCategoryName, type EventRow } from "@/lib/events";
import { Reveal } from "@/components/ui/reveal";
import { photo, formatPrice } from "@/lib/utils";

function fmtDate(d: string | null): string {
  if (!d) return "Date TBA";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Homepage Events & Expo section — real admin-published events. */
export function EventsGrid({ items }: { items: EventRow[] }) {
  if (!items || items.length === 0) return null;
  const shown = items.slice(0, 4);
  const cols = "lg:grid-cols-4";

  return (
    <section className="bg-forest-50/40 py-12 sm:py-16">
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">
              Events &amp; Expo
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Festivals, expos and cultural nights across Gilgit-Baltistan.
            </p>
          </div>
          <Link
            href="/events"
            className="group inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            View All Events
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className={`grid grid-cols-2 gap-3 sm:gap-5 ${cols}`}>
          {shown.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2"
            >
              <div className="relative h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo(e.image || "https://picsum.photos/seed/event/900/600", 500)}
                  alt={e.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-600 backdrop-blur">
                  {eventCategoryName(e.category)}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-base font-semibold leading-snug text-forest">
                  {e.title}
                </h3>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-gold" /> {fmtDate(e.start_date)}
                  {e.city && (
                    <>
                      <MapPin className="ml-1 h-3.5 w-3.5" /> {e.city}
                    </>
                  )}
                </p>
                <span className="mt-2 flex items-center gap-1 text-sm font-semibold text-forest">
                  <Ticket className="h-4 w-4 text-forest-600" />
                  {e.ticket_price > 0 ? formatPrice(e.ticket_price) : "Free"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
