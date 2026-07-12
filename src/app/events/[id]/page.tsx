import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  CalendarDays,
  Clock,
  MapPin,
  Ticket,
  User,
  Navigation,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getEventById, eventCategoryName } from "@/lib/events";
import { photo, formatPrice } from "@/lib/utils";

export const revalidate = 60;

function fmtDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const e = await getEventById(id);
  if (!e) return { title: "Event" };
  return {
    title: e.title,
    description: (e.description ?? `${e.title} in ${e.city || "Gilgit-Baltistan"}`).slice(0, 160),
    alternates: { canonical: `/events/${id}` },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const e = await getEventById(id);
  if (!e || e.status !== "published") notFound();

  const range =
    e.end_date && e.end_date !== e.start_date
      ? `${fmtDate(e.start_date)} – ${fmtDate(e.end_date)}`
      : fmtDate(e.start_date) || "Date to be announced";
  const mapQuery = encodeURIComponent(
    [e.venue, e.address, e.city, "Gilgit Baltistan"].filter(Boolean).join(" ")
  );

  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-16">
        {/* Cover */}
        <div className="relative h-64 w-full overflow-hidden sm:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo(e.image || "https://picsum.photos/seed/event/1600/700")}
            alt={e.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="container-px absolute inset-x-0 bottom-0 pb-6">
            <span className="inline-block rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest-600">
              {eventCategoryName(e.category)}
            </span>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold text-white sm:text-4xl">
              {e.title}
            </h1>
          </div>
        </div>

        <div className="container-px pt-6">
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold"
          >
            <ChevronLeft className="h-4 w-4" /> All events
          </Link>
        </div>

        <div className="container-px mt-6 grid gap-10 lg:grid-cols-[1fr_340px]">
          {/* Main */}
          <div className="min-w-0 space-y-8">
            {e.description && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">About this event</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
                  {e.description}
                </p>
              </section>
            )}

            {(e.highlights?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Highlights</h2>
                <ul className="mt-3 space-y-2">
                  {e.highlights!.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" /> {h}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(e.gallery?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Gallery</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {e.gallery!.map((g, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={photo(g)} alt="" className="h-32 w-full rounded-xl object-cover" />
                  ))}
                </div>
              </section>
            )}

            {mapQuery && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Location</h2>
                {(e.venue || e.address) && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {[e.venue, e.address, e.city].filter(Boolean).join(", ")}
                  </p>
                )}
                <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                  <iframe
                    title="Event location"
                    className="h-64 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                  />
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside>
            <div className="sticky top-28 space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Entry</span>
                <span className="font-display text-2xl font-bold text-forest">
                  {e.ticket_price > 0 ? formatPrice(e.ticket_price) : "Free"}
                </span>
              </div>

              {e.registration_url && (
                <a
                  href={e.registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 font-semibold text-white shadow-soft hover:opacity-95"
                >
                  <Ticket className="h-5 w-5" /> Register / Tickets
                </a>
              )}

              <div className="space-y-2 border-t border-border pt-4 text-sm">
                <Row icon={CalendarDays} label="Date" value={range} />
                {e.time && <Row icon={Clock} label="Time" value={e.time} />}
                {(e.venue || e.city) && (
                  <Row icon={MapPin} label="Venue" value={[e.venue, e.city].filter(Boolean).join(", ")} />
                )}
                {e.organizer && <Row icon={User} label="Organizer" value={e.organizer} />}
                {e.ticket_info && <Row icon={Ticket} label="Tickets" value={e.ticket_info} />}
                {mapQuery && (
                  <a
                    href={`https://www.google.com/maps?q=${mapQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 pt-1 text-sm font-semibold text-forest-600 hover:text-gold"
                  >
                    <Navigation className="h-4 w-4" /> Get directions
                  </a>
                )}
                {e.registration_url && (
                  <a
                    href={e.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-semibold text-forest-600 hover:text-gold"
                  >
                    <ExternalLink className="h-4 w-4" /> Event website
                  </a>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="text-right font-medium text-forest">{value}</span>
    </div>
  );
}
