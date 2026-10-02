import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ArrowRight, Compass } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { buildMetadata } from "@/lib/seo";
import { getDestinations } from "@/lib/destinations";
import { photo } from "@/lib/utils";

/* ISR window. Marketplace content changes when a provider lists or an
   admin approves — a few times a day, not every minute. At 60s every
   path regenerated up to 60 times an hour whether anything had changed
   or not, which was the main driver of Vercel Fluid Active CPU.

   This is ISR, not static: the first request after the window still
   serves instantly from cache and refreshes behind it, so nobody waits.
   The visible cost is that a newly approved listing can take this long
   to appear. */
export const revalidate = 600;

export const metadata: Metadata = buildMetadata({
  title: "Destinations in Gilgit-Baltistan",
  description:
    "Explore every destination in Gilgit-Baltistan — Skardu, Hunza, Naran, Deosai, Fairy Meadows and more. Find verified hotels, tours, transport and guides in each valley.",
  path: "/destinations",
});

export default async function DestinationsPage() {
  const destinations = await getDestinations();

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-forest text-white">
          <div className="container-px py-14 sm:py-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold">
              <Compass className="h-3.5 w-3.5" /> Explore
            </span>
            <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">
              Destinations in Gilgit-Baltistan
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              From the lakes of Skardu to the orchards of Hunza and the plains of Deosai — pick a
              valley and find verified stays, tours, transport and guides there.
            </p>
          </div>
        </section>

        {/* Grid */}
        <section className="container-px py-10 sm:py-12">
          {destinations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-12 text-center">
              <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 font-display text-base font-bold text-forest">
                No destinations yet
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Destinations added from the admin dashboard will appear here.
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl font-bold uppercase text-forest sm:text-2xl">
                {destinations.length} destination{destinations.length === 1 ? "" : "s"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap a destination to see everything available there.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {destinations.map((d) => (
                  <Link
                    key={d.slug}
                    href={`/destinations/${d.slug}`}
                    className="group relative overflow-hidden rounded-3xl shadow-premium transition-all hover:-translate-y-1 hover:shadow-premium-lg"
                  >
                    <div className="relative h-56">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo(d.image, 700)}
                        alt={d.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-forest-900/85 via-forest-900/25 to-transparent" />

                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="flex items-center gap-1 text-xs font-semibold text-white/80">
                          <MapPin className="h-3.5 w-3.5 text-gold" /> {d.location}
                        </p>
                        <h3 className="mt-0.5 font-display text-xl font-bold">{d.name}</h3>
                        <p className="mt-0.5 line-clamp-1 text-sm text-white/85">{d.tagline}</p>
                        <div className="mt-3 flex items-center justify-between">
                          {d.stays ? (
                            <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur">
                              {d.stays}
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-gold">
                            Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
