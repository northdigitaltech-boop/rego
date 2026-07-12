import type { Metadata } from "next";
import Link from "next/link";
import { Compass, UserPlus, ShieldCheck, Users, Sparkles } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { TravelerCard } from "@/components/solo/traveler-card";
import { getApprovedSolo, GB_DESTINATIONS } from "@/lib/solo";
import { cn } from "@/lib/utils";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Connect Solo Traveler",
  description:
    "Find verified travel companions for Gilgit-Baltistan. Share your trip, split transport and accommodation costs, and explore safely together.",
  alternates: { canonical: "/connect" },
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const active = (Array.isArray(sp.destination) ? sp.destination[0] : sp.destination) ?? "";

  const all = await getApprovedSolo();
  const travelers = active
    ? all.filter((t) =>
        (t.destinations ?? []).some(
          (d) => d.toLowerCase() === active.toLowerCase()
        )
      )
    : all;

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1533130061792-64b345e4a833?w=1600&q=80')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-900 via-forest-900/80 to-forest-900/50" />
          </div>
          <div className="container-px py-16 sm:py-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              <Compass className="h-4 w-4 text-gold" /> Connect Solo Traveler
            </span>
            <h1 className="mt-4 max-w-3xl font-display text-3xl font-extrabold text-white sm:text-5xl">
              Find your travel companion for Gilgit-Baltistan
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-white/85">
              Meet verified solo travellers heading to the same destination. Share your journey,
              split costs, and explore safer together.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/connect/setup"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 font-semibold text-forest-900 shadow-soft transition-transform hover:-translate-y-0.5"
              >
                <UserPlus className="h-5 w-5" /> Create your traveller profile
              </Link>
              <Link
                href="/connect/requests"
                className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                <Users className="h-5 w-5" /> My connections
              </Link>
            </div>

            {/* Trust strip */}
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-gold" /> Verified profiles
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-gold" /> Compatibility matching
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-gold" /> Cost sharing
              </span>
            </div>
          </div>
        </section>

        {/* Destination filter chips */}
        <section className="border-b border-border bg-background">
          <div className="container-px flex gap-2 overflow-x-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip label="All destinations" href="/connect" active={!active} />
            {GB_DESTINATIONS.map((d) => (
              <FilterChip
                key={d}
                label={d}
                href={`/connect?destination=${encodeURIComponent(d)}`}
                active={active.toLowerCase() === d.toLowerCase()}
              />
            ))}
          </div>
        </section>

        {/* Grid */}
        <section className="container-px py-10 sm:py-12">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold uppercase text-forest sm:text-2xl">
                {active ? `Travellers heading to ${active}` : "Solo travellers"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {travelers.length} traveller{travelers.length === 1 ? "" : "s"} available
              </p>
            </div>
          </div>

          {travelers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center">
              <Compass className="mx-auto h-10 w-10 text-forest-600" />
              <p className="mt-3 font-display text-lg font-semibold text-forest">
                No traveller profiles here yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Be the first to list your trip{active ? ` to ${active}` : ""} and find companions.
              </p>
              <Link
                href="/connect/setup"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-forest px-5 py-3 text-sm font-semibold text-white shadow-soft hover:opacity-95"
              >
                <UserPlus className="h-4 w-4" /> Create your profile
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {travelers.map((t) => (
                <TravelerCard key={t.id} t={t} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "border-forest-600 bg-forest-600 text-white"
          : "border-border bg-card text-forest hover:border-gold/60 hover:text-gold"
      )}
    >
      {label}
    </Link>
  );
}
