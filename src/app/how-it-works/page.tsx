import type { Metadata } from "next";
import Link from "next/link";
import { Search, GitCompare, CalendarCheck, Plane } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Planning your trip to Gilgit Baltistan with Rego is simple: search, compare, book and travel.",
};

const steps = [
  {
    icon: Search,
    title: "Search",
    description:
      "Tell us where you're headed and what you need — stays, tours, transport, guides and more.",
  },
  {
    icon: GitCompare,
    title: "Compare",
    description:
      "Browse verified options with transparent prices, real photos and genuine traveler reviews.",
  },
  {
    icon: CalendarCheck,
    title: "Book",
    description:
      "Reserve in a few clicks with no hidden charges. You'll get instant confirmation.",
  },
  {
    icon: Plane,
    title: "Travel",
    description:
      "Enjoy your trip with 24/7 support from our team and trusted local partners.",
  },
];

const faqs = [
  {
    q: "Is it free to use Rego?",
    a: "Yes — browsing and booking on Rego is free for travelers. You only pay for the services you book.",
  },
  {
    q: "Are the listings verified?",
    a: "Every partner is reviewed and verified by our team, and listings carry genuine traveler ratings.",
  },
  {
    q: "Can I book everything in one trip?",
    a: "Absolutely. You can book hotels, transport, guides, activities and more — all across Gilgit Baltistan.",
  },
  {
    q: "What if I need help during my trip?",
    a: "Our support team is available 24/7 to help with any changes or questions while you travel.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-forest py-14 text-white">
          <div className="container-px">
            <p className="font-script text-3xl text-gold">Simple & seamless</p>
            <h1 className="font-display text-4xl font-extrabold sm:text-5xl">
              How Rego works
            </h1>
            <p className="mt-3 max-w-xl text-white/85">
              From dreaming to departing, we make planning your Gilgit Baltistan
              trip effortless — in four easy steps.
            </p>
          </div>
        </section>

        {/* Steps */}
        <section className="bg-background py-16">
          <div className="container-px grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.title}
                  className="relative rounded-2xl border border-border bg-card p-6 shadow-premium"
                >
                  <span className="absolute right-5 top-5 font-display text-4xl font-extrabold text-forest-50">
                    {i + 1}
                  </span>
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-forest-600 text-gold">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold text-forest">
                    {s.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Two audiences */}
        <section className="bg-forest-50/50 py-16">
          <div className="container-px grid gap-6 lg:grid-cols-2">
            <div
              id="travelers"
              className="scroll-mt-24 rounded-2xl bg-card p-8 shadow-premium"
            >
              <h2 className="font-display text-2xl font-bold text-forest">
                For travelers
              </h2>
              <p className="mt-3 text-muted-foreground">
                Discover and book everything for your trip in one place, with
                verified partners and best-price confidence.
              </p>
              <Button asChild variant="gold" className="mt-5 rounded-lg">
                <Link href="/listings">Start exploring</Link>
              </Button>
            </div>
            <div
              id="providers"
              className="scroll-mt-24 rounded-2xl bg-card p-8 shadow-premium"
            >
              <h2 className="font-display text-2xl font-bold text-forest">
                For service providers
              </h2>
              <p className="mt-3 text-muted-foreground">
                List your hotel, tour, transport or service and reach thousands of
                travelers heading to Gilgit Baltistan.
              </p>
              <Button asChild variant="outline" className="mt-5 rounded-lg">
                <Link href="/partner">Become a partner</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-background py-16">
          <div className="container-px mx-auto max-w-3xl">
            <h2 className="text-center font-display text-3xl font-bold text-forest">
              Frequently asked questions
            </h2>
            <div className="mt-8 space-y-3">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-border bg-card p-5 shadow-premium"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-forest">
                    {f.q}
                    <span className="text-gold transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
