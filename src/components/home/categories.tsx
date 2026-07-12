"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { KeyRound, ChevronRight, type LucideIcon } from "lucide-react";

import { categories } from "@/lib/data";
import { Reveal } from "@/components/ui/reveal";

const MotionLink = motion.create(Link);

const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

const TOP8: { name: string; href: string; Icon: LucideIcon }[] = [
  ...["hotels", "homestays", "tours", "transport", "travel-companies", "guides", "restaurants"]
    .map((s) => bySlug[s])
    .filter(Boolean)
    .map((c) => ({ name: c.name, href: `/categories/${c.slug}`, Icon: c.icon as LucideIcon })),
  { name: "Rentals", href: "/categories/transport", Icon: KeyRound },
];

export function Categories() {
  const reduce = useReducedMotion();
  return (
    <section id="categories" className="bg-background py-12 sm:py-16">
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">Browse by service</h2>
            <p className="mt-1 text-sm text-muted-foreground">Everything you need for a trip to Gilgit-Baltistan.</p>
          </div>
          <Link
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
              <MotionLink
                key={cat.name}
                href={cat.href}
                initial={{ opacity: 0, y: reduce ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : i * 0.04 }}
                whileHover={reduce ? undefined : { y: -4 }}
                className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-2 py-5 text-center shadow-premium transition-[colors,box-shadow,border-color] hover:border-gold/60 hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-50 text-forest-600 transition-colors group-hover:bg-gradient-gold group-hover:text-forest-900">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-xs font-semibold leading-tight text-forest">{cat.name}</span>
              </MotionLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
