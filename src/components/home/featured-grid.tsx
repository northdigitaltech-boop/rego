"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { HotelCarousel } from "@/components/home/hotel-carousel";
import { ServiceCard, gridForVariant, type ServiceCardVariant } from "@/components/home/service-cards";
import { Reveal } from "@/components/ui/reveal";
import { type Listing } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Presentational top-N grid. Data is fetched server-side and passed in. */
export function FeaturedGrid({
  title,
  subtitle,
  items,
  viewAllHref,
  viewAllLabel,
  hidePrice = false,
  carousel = false,
  alt = false,
  variant = "default",
}: {
  title: string;
  subtitle?: string;
  items: Listing[];
  viewAllHref: string;
  viewAllLabel: string;
  hidePrice?: boolean;
  /** Opt-in horizontal carousel (used for the Featured Hotels section). */
  carousel?: boolean;
  /** Soft off-white background for alternating section rhythm. */
  alt?: boolean;
  /** Per-service card style (person / brand / spec / journey / food). */
  variant?: ServiceCardVariant;
}) {
  if (!items || items.length === 0) return null;
  // Grid sections show at most 4 cards; the carousel slides through more.
  const shown = carousel ? items.slice(0, 12) : items.slice(0, 4);

  return (
    <section className={cn("py-12 sm:py-16", alt ? "bg-muted/30" : "bg-background")}>
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <Link
            href={viewAllHref}
            className="group inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            {viewAllLabel}
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
        {carousel ? (
          <HotelCarousel items={shown} hidePrice={hidePrice} label={title} />
        ) : (
          <div className={gridForVariant(variant, shown.length)}>
            {shown.map((l, i) => (
              <ServiceCard key={l.id} listing={l} index={i} hidePrice={hidePrice} variant={variant} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
