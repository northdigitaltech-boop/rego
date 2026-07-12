import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, Ticket, Sparkles } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  getPublishedEvents,
  getEventCounts,
  EVENT_CATEGORIES,
  eventCategoryName,
  isEventCategory,
  type EventRow,
} from "@/lib/events";
import { photo, formatPrice, cn } from "@/lib/utils";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Events & Expo",
  description:
    "Festivals, tourism events, local expos and cultural nights across Gilgit-Baltistan. Discover what's on and plan your trip around it.",
  alternates: { canonical: "/events" },
};

function fmtDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function dateRange(e: EventRow): string {
  if (!e.start_date) return "Date TBA";
  const s = fmtDate(e.start_date);
  if (e.end_date && e.end_date !== e.start_date) return `${s} – ${fmtDate(e.end_date)}`;
  return s;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawCat = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const category = rawCat && isEventCategory(rawCat) ? rawCat : "";

  const [events, counts] = await Promise.all([
    getPublishedEvents(category || undefined),
    getEventCounts(),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-forest text-white">
          <div className="container-px py-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <Sparkles className="h-4 w-4" /> Events &amp; Expo
            </span>
            <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold uppercase sm:text-4xl">
              What&apos;s on in Gilgit-Baltistan
            </h1>
            <p className="mt-3 max-w-2xl text-white/85">
              Festivals, tourism events, expos and cultural nights — discover experiences to plan
              your trip around.
            </p>
          </div>
        </section>

        {/* Category filter */}
        <section className="container-px pt-8">
          <div className="flex flex-wrap gap-2">
            <FilterChip href="/events" active={!category} label={`All (${total})`} />
            {EVENT_CATEGORIES.map((c) => (
              <FilterChip
                key={c.slug}
                href={`/events?category=${c.slug}`}
                active={category === c.slug}
                label={`${c.name} (${counts[c.slug] ?? 0})`}
              />
            ))}
          </div>
        </section>

        {/* Grid */}
        <section className="container-px pb-16 pt-6">
          <h2 className="font-display text-xl font-bold uppercase text-forest sm:text-2xl">
            {category ? eventCategoryName(category) : "All events"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {events.length} event{events.length === 1 ? "" : "s"}
          </p>

          {events.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center">
              <CalendarDays className="mx-auto h-10 w-10 text-forest-600" />
              <p className="mt-3 font-display text-lg font-semibold text-forest">No events yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Check back soon — new events are added regularly.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <EventCard key={e.id} event={e} range={dateRange(e)} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "border-forest-600 bg-gradient-forest text-white"
          : "border-border bg-card text-forest hover:bg-muted"
      )}
    >
      {label}
    </Link>
  );
}

function EventCard({ event: e, range }: { event: EventRow; range: string }) {
  return (
    <Link
      href={`/events/${e.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg"
    >
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo(e.image || "https://picsum.photos/seed/event/900/600")}
          alt={e.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-600 backdrop-blur">
          {eventCategoryName(e.category)}
        </span>
        {e.featured && (
          <span className="absolute right-3 top-3 rounded-full bg-gradient-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-900 shadow-gold-glow">
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-bold leading-snug text-forest">{e.title}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-gold" /> {range}
        </p>
        {(e.city || e.venue) && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> {[e.venue, e.city].filter(Boolean).join(", ")}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between pt-1">
          <span className="flex items-center gap-1 text-sm font-semibold text-forest">
            <Ticket className="h-4 w-4 text-forest-600" />
            {e.ticket_price > 0 ? formatPrice(e.ticket_price) : "Free"}
          </span>
          <span className="text-sm font-semibold text-forest-600 group-hover:text-gold">
            View details →
          </span>
        </div>
      </div>
    </Link>
  );
}
