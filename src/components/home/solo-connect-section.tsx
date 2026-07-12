import Link from "next/link";
import { ChevronRight, Compass, UserPlus } from "lucide-react";

import { TravelerCard } from "@/components/solo/traveler-card";
import { Reveal } from "@/components/ui/reveal";
import { type SoloTravelerRow } from "@/lib/solo";

/** Homepage "Connect Solo Traveler" section — real approved traveller cards. */
export function SoloConnectSection({ items }: { items: SoloTravelerRow[] }) {
  return (
    <section className="bg-background py-12 sm:py-16">
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest-700">
              <Compass className="h-3.5 w-3.5" /> Travel Together
            </span>
            <h2 className="mt-2 font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">
              Connect Solo Traveler
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Find verified companions, share your trip, reduce costs, and explore Gilgit-Baltistan together.
            </p>
          </div>
          <Link
            href="/connect"
            className="group inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            Explore Travelers
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {items.slice(0, 4).map((t) => (
              <TravelerCard key={t.id} t={t} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-border/70 bg-gradient-to-br from-forest-50/60 to-gold/5 p-8 text-center shadow-premium sm:flex-row sm:text-left">
            <div>
              <h3 className="font-display text-lg font-bold text-forest">Travelling to GB solo?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a free traveller profile and match with companions heading the same way.
              </p>
            </div>
            <Link
              href="/connect/setup"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-forest px-5 py-3 text-sm font-semibold text-white shadow-soft transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2"
            >
              <UserPlus className="h-4 w-4" /> Create your profile
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
