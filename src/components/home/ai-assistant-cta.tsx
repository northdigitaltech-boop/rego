import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

import { Reveal } from "@/components/ui/reveal";

const EXAMPLES = [
  "Find me a hotel in Hunza",
  "Plan a 5-day Skardu trip",
  "Find a Prado rental",
  "Recommend a local guide",
];

export function AIAssistantCTA() {
  return (
    <section className="bg-background py-12 sm:py-16">
      <Reveal className="container-px">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-forest px-6 py-12 text-center shadow-premium-lg sm:px-12">
          {/* glow accents */}
          <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-gold/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Rego AI
          </span>
          <h2 className="relative mt-4 font-display text-3xl font-bold uppercase text-white sm:text-4xl">
            Need help planning your trip?
          </h2>
          <p className="relative mx-auto mt-2 max-w-xl text-sm text-white/80 sm:text-base">
            Tell us what you&apos;re looking for and we&apos;ll point you to the right stays, tours, rentals and guides across Gilgit-Baltistan.
          </p>

          <div className="relative mt-6 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <Link
                key={ex}
                href={`/rego-ai?q=${encodeURIComponent(ex)}`}
                className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {ex}
              </Link>
            ))}
          </div>

          <Link
            href="/rego-ai"
            className="relative mt-7 inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 font-display text-base font-bold text-forest-900 shadow-soft transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-forest-700"
          >
            Ask Rego AI <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
