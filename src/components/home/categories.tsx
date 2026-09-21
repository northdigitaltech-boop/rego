"use client";

import Link from "next/link";
import { KeyRound, ChevronRight, type LucideIcon } from "lucide-react";

import { categories } from "@/lib/data";
import { Reveal } from "@/components/ui/reveal";

const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

const TOP8: { name: string; href: string; Icon: LucideIcon }[] = [
  /* "Rentals" used to be a hand-written eighth tile pointing at the
     transport page, because there was nowhere else for it to go. It has
     its own category now, so it comes from the same list as the rest —
     one less place for the label and the destination to disagree. The
     key icon is kept: it reads as "rent" better than a car does next to
     Transport's bus. */
  ...["hotels", "homestays", "tours", "transport", "travel-companies", "guides", "restaurants"]
    .map((s) => bySlug[s])
    .filter(Boolean)
    .map((c) => ({ name: c.name, href: `/categories/${c.slug}`, Icon: c.icon as LucideIcon })),
  ...(bySlug["vehicle-rental"]
    ? [
        {
          name: bySlug["vehicle-rental"].name,
          href: "/rentals",
          Icon: KeyRound,
        },
      ]
    : []),
];

export function Categories() {
  return (
    <section id="categories" className="bg-background py-12 sm:py-16">
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">Browse by service</h2>
            <p className="mt-1 text-sm text-muted-foreground">Everything you need for a trip to Gilgit-Baltistan.</p>
          </div>
          <Link
            prefetch={false}
            href="/listings"
            className="group inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            View All Services
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {TOP8.map((cat, i) => {
            const Icon = cat.Icon;
            return (
              /* Reveal does the fade-in; the hover lift is a CSS transform.
                 motion-safe: keeps both off for anyone who asked their
                 system not to animate, which is what useReducedMotion was
                 doing here. */
              <Reveal key={cat.name} index={i}>
              <Link
                prefetch={false}
                href={cat.href}
                className="group flex h-full flex-col items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-2 py-5 text-center shadow-premium transition-[colors,box-shadow,border-color,transform] duration-200 hover:border-gold/60 hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 motion-safe:hover:-translate-y-1"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-50 text-forest-600 transition-colors group-hover:bg-gradient-gold group-hover:text-forest-900">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-xs font-semibold leading-tight text-forest">{cat.name}</span>
              </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
