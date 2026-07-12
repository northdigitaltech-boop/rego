"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  Star,
  MapPin,
  BadgeCheck,
  ShieldCheck,
  Clock,
  LifeBuoy,
  Wrench,
} from "lucide-react";

import { type RoadsideCard } from "@/lib/home-feed";
import { Reveal } from "@/components/ui/reveal";
import { formatPrice } from "@/lib/utils";

/** Homepage Roadside Assistance section — real approved provider cards. */
export function RoadsideProviderGrid({ items }: { items: RoadsideCard[] }) {
  const reduce = useReducedMotion();
  if (!items || items.length === 0) return null;
  const shown = items.slice(0, 4);
  const cols = "lg:grid-cols-4";

  return (
    <section className="bg-forest-50/40 py-12 sm:py-16">
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">
              Roadside Assistance
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Verified help on the road, when you need it.
            </p>
          </div>
          <Link
            href="/roadside"
            className="group inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            View All Providers
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className={`grid grid-cols-2 gap-3 sm:gap-5 ${cols}`}>
          {shown.map((p, i) => (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: reduce ? 0 : 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : i * 0.07 }}
              whileHover={reduce ? undefined : { y: -8 }}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-shadow hover:shadow-premium-lg"
            >
              <Link
                href={`/roadside/provider/${p.id}`}
                className="absolute inset-0 z-10 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2"
                aria-label={p.name}
              />
              <div className="relative h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
                  {p.is247 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                      <ShieldCheck className="h-3 w-3" /> 24/7
                    </span>
                  ) : (
                    <span />
                  )}
                  {p.verified && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-forest-600 backdrop-blur">
                      <BadgeCheck className="h-3 w-3 text-gold" /> Verified
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-base font-semibold leading-snug text-forest">
                  {p.name}
                </h3>

                <div className="mt-1.5 flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                  <span className="text-xs font-semibold text-forest">{p.rating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({p.reviews})</span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {p.location}
                  </span>
                </div>

                {/* Service badges */}
                {p.services.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.services.slice(0, 2).map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-forest"
                      >
                        <Wrench className="h-2.5 w-2.5" /> {s}
                      </span>
                    ))}
                    {p.services.length > 2 && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        +{p.services.length - 2}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  {p.responseTime && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {p.responseTime}
                    </span>
                  )}
                  {p.startingPrice > 0 && (
                    <span className="ml-auto font-display text-sm font-bold text-forest">
                      {formatPrice(p.startingPrice)}
                    </span>
                  )}
                </div>

                <span className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-2 text-sm font-semibold text-white shadow-soft transition-opacity group-hover:opacity-95">
                  <LifeBuoy className="h-4 w-4" /> Get Help
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
