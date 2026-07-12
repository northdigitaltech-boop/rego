import type { Metadata } from "next";
import Link from "next/link";
import {
  Plane,
  CloudSun,
  Clock,
  ShieldCheck,
  Headset,
  MapPin,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { FlightSearch } from "@/components/flights/flight-search";

export const metadata: Metadata = {
  title: "Flights to Gilgit Baltistan",
  description:
    "Search and compare flights to Gilgit and Skardu on PIA, Airblue and Air Sial. Find the best fares to Gilgit Baltistan and book in a few taps with Rego.",
  alternates: { canonical: "/flights" },
  openGraph: {
    title: "Flights to Gilgit Baltistan — Rego",
    description:
      "Compare PIA, Airblue and Air Sial fares to Gilgit (GIL) and Skardu (KDU).",
    url: "/flights",
    type: "website",
  },
};

const AIRLINES = [
  {
    name: "PIA — Pakistan International Airlines",
    note: "Main operator to Gilgit (GIL) & Skardu (KDU).",
    href: "https://www.piac.com.pk/",
    code: "PK",
  },
  {
    name: "Airblue",
    note: "Domestic trunk routes — Islamabad, Karachi, Lahore.",
    href: "https://www.airblue.com/",
    code: "PA",
  },
  {
    name: "Air Sial",
    note: "Domestic network across major Pakistani cities.",
    href: "https://www.airsial.com/",
    code: "PF",
  },
];

const ROUTES = [
  { from: "Islamabad", to: "Skardu", code: "ISB → KDU" },
  { from: "Islamabad", to: "Gilgit", code: "ISB → GIL" },
  { from: "Karachi", to: "Skardu", code: "KHI → KDU" },
  { from: "Lahore", to: "Skardu", code: "LHE → KDU" },
];

export default function FlightsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        {/* Hero + search */}
        <section className="border-b border-border bg-gradient-forest">
          <div className="container-px py-12 sm:py-16">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                <Plane className="h-3.5 w-3.5" /> Flights
              </span>
              <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
                Fly to Gilgit &amp; Skardu
              </h1>
              <p className="mt-2 text-white/85">
                Compare live fares on PIA, Airblue and Air Sial, then book on the
                airline checkout — or let our team arrange it for you.
              </p>
            </div>
            <div className="mt-6">
              <FlightSearch />
            </div>
          </div>
        </section>

        {/* Popular GB routes */}
        <section className="container-px py-10">
          <h2 className="font-display text-2xl font-bold text-forest">
            Popular routes to Gilgit Baltistan
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROUTES.map((r) => (
              <div
                key={r.code}
                className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium"
              >
                <p className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-forest-600">
                  <MapPin className="h-3.5 w-3.5" /> {r.code}
                </p>
                <p className="mt-2 font-display text-lg font-semibold text-forest">
                  {r.from} → {r.to}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Direct & one-stop options
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Airlines */}
        <section className="container-px pb-10">
          <h2 className="font-display text-2xl font-bold text-forest">
            Airlines serving Gilgit Baltistan
          </h2>
          <p className="mt-1 text-muted-foreground">
            Book directly with any airline operating in the region.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {AIRLINES.map((a) => (
              <a
                key={a.name}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-3xl border border-border/70 bg-card p-6 shadow-premium transition-shadow hover:shadow-premium-lg"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-forest text-gold">
                  <Plane className="h-6 w-6" />
                </span>
                <p className="mt-4 font-display text-base font-bold text-forest">
                  {a.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{a.note}</p>
                <span className="mt-3 inline-block text-sm font-semibold text-forest-600 group-hover:text-gold">
                  Book on airline site →
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Good to know */}
        <section className="container-px pb-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <InfoCard
              icon={CloudSun}
              title="Weather-dependent"
              body="Gilgit & Skardu flights can be delayed or cancelled in poor weather. Keep a flexible plan and a road backup."
            />
            <InfoCard
              icon={Clock}
              title="Book early"
              body="Seats on GB routes sell out fast in summer (May–September). Searching early gets the best fares."
            />
            <InfoCard
              icon={ShieldCheck}
              title="Secure checkout"
              body="Payment and ticketing happen on the airline or partner site — your card details never touch Rego."
            />
          </div>
        </section>

        {/* Concierge CTA */}
        <section className="container-px pb-16">
          <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-border/70 bg-forest-50/60 p-6 shadow-premium sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 font-display text-xl font-bold text-forest">
                <Headset className="h-5 w-5 text-forest-600" /> Want us to book it for you?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us your dates and budget — our team will find the best fare
                and confirm your seats, including connecting transfers in GB.
              </p>
            </div>
            <Link
              href="/contact"
              className="shrink-0 rounded-xl bg-gradient-forest px-5 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
            >
              Request booking help
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Plane;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-forest-50 text-forest-600">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-display text-base font-bold text-forest">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
