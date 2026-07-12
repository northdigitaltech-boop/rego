import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy, TriangleAlert } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { roadsideCategories } from "@/lib/data";
import { getServiceCounts } from "@/lib/roadside";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Roadside Assistance",
  description:
    "Emergency roadside assistance across Gilgit Baltistan — bike & car puncture repair, battery jump-starts, fuel delivery and vehicle recovery from verified local providers.",
  alternates: { canonical: "/roadside" },
};

export default async function RoadsidePage() {
  const counts = await getServiceCounts();

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-forest text-white">
          <div className="container-px py-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <LifeBuoy className="h-4 w-4" /> Emergency Roadside Assistance
            </span>
            <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold uppercase sm:text-4xl">
              Stuck on the road? Help is close by
            </h1>
            <p className="mt-3 max-w-2xl text-white/85">
              Find verified roadside assistance providers across Gilgit Baltistan and send an
              emergency request in seconds — punctures, battery, fuel or full vehicle recovery.
            </p>
            <Link
              href="/roadside/updates"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 text-sm font-semibold text-forest-900 shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <TriangleAlert className="h-4 w-4" /> Live Road Updates &amp; Alerts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Service cards */}
        <section className="container-px py-12">
          <h2 className="font-display text-xl font-bold uppercase text-forest sm:text-2xl">
            Choose a service
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select the help you need to see available providers near you.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {roadsideCategories.map((c) => {
              const Icon = c.icon;
              const count = counts[c.slug] ?? 0;
              return (
                <Link
                  key={c.slug}
                  href={`/roadside/${c.slug}`}
                  className="group flex flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-premium transition-shadow hover:shadow-card"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-forest-50 text-forest-600 transition-colors group-hover:bg-forest-600 group-hover:text-white">
                    <Icon className="h-7 w-7" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold text-forest">{c.name}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.tagline}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-forest">
                      {count} provider{count === 1 ? "" : "s"}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-forest-600 group-hover:text-gold">
                      Find Help <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
