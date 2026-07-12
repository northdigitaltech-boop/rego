"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Star, MapPin, Award, Layers, ChevronRight, Plane } from "lucide-react";

import {
  getApprovedMediaProviders,
  getPortfolioByProvider,
  type MediaProviderRow,
  type MediaPortfolioRow,
} from "@/lib/media";
import { Reveal } from "@/components/ui/reveal";
import { photo } from "@/lib/utils";

const MotionLink = motion.create(Link);

interface Creator {
  provider: MediaProviderRow;
  portfolio: MediaPortfolioRow[];
}

function score(p: MediaProviderRow): number {
  const drone =
    p.drone_available || /drone/i.test(p.service_type || "") ? 100 : 0;
  return (p.featured ? 1000 : 0) + drone + Number(p.rating) * 10;
}

export function FeaturedDroneCreators() {
  const reduce = useReducedMotion();
  const [creators, setCreators] = React.useState<Creator[]>([]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const providers = await getApprovedMediaProviders();
      const top = [...providers].sort((a, b) => score(b) - score(a)).slice(0, 4);
      const withPortfolio = await Promise.all(
        top.map(async (provider) => ({
          provider,
          portfolio: await getPortfolioByProvider(provider.id),
        }))
      );
      if (alive) setCreators(withPortfolio.filter((c) => c.portfolio.length > 0 || c.provider.featured));
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (creators.length === 0) return null;

  return (
    <section className="bg-gradient-to-b from-forest-50/40 to-background py-12 sm:py-16">
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest-700">
              <Plane className="h-3.5 w-3.5" /> Drone &amp; Media
            </span>
            <h2 className="mt-2 font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">
              Featured Drone Creators
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Top-rated photographers, videographers &amp; drone pilots across Gilgit-Baltistan.
            </p>
          </div>
          <Link
            href="/categories/photographers"
            className="group inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            View All
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {creators.map((c, i) => (
            <CreatorCard key={c.provider.id} creator={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CreatorCard({ creator, index }: { creator: Creator; index: number }) {
  const reduce = useReducedMotion();
  const { provider: p, portfolio } = creator;
  const preview = portfolio.slice(0, 3);
  const avatar = photo(p.logo || p.cover_image || "");

  return (
    <MotionLink
      href={`/listings/${p.id}`}
      initial={{ opacity: 0, y: reduce ? 0 : 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: reduce ? 0 : 0.45, delay: reduce ? 0 : index * 0.07 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2"
    >
      {/* portfolio preview */}
      <div className="relative grid h-32 grid-cols-3 gap-0.5 bg-forest-50">
        {preview.length > 0 ? (
          preview.map((item, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.id}
              src={photo(item.url || (item.gallery && item.gallery[0]) || "")}
              alt=""
              loading="lazy"
              decoding="async"
              className={
                "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" +
                (preview.length === 1 ? " col-span-3" : "")
              }
              style={preview.length === 1 ? { gridColumn: "span 3" } : undefined}
            />
          ))
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo(p.cover_image || "")} alt="" loading="lazy" decoding="async" className="col-span-3 h-full w-full object-cover" />
        )}
        {p.featured && (
          <span className="absolute right-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase text-forest-900 shadow">
            Featured
          </span>
        )}
      </div>

      {/* profile */}
      <div className="flex flex-1 flex-col p-4">
        <div className="-mt-9 flex items-end gap-3">
          <span className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-forest-100 shadow-premium">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-forest">
                {p.name.charAt(0)}
              </span>
            )}
          </span>
          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-xs font-bold text-forest shadow-sm">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" />
            {Number(p.rating).toFixed(1)}
          </span>
        </div>

        <h3 className="mt-2 line-clamp-1 font-display text-base font-bold text-forest">{p.name}</h3>
        <p className="text-xs text-muted-foreground">{p.service_type || "Media creator"}</p>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {(p.location || p.city) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {p.location || p.city}
            </span>
          )}
          {p.experience_years != null && (
            <span className="inline-flex items-center gap-1">
              <Award className="h-3.5 w-3.5" /> {p.experience_years}+ yrs
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> {portfolio.length} projects
          </span>
        </div>

        <span className="mt-3 inline-flex items-center justify-center gap-1 rounded-lg border border-forest/30 py-2 text-sm font-semibold text-forest transition-colors group-hover:bg-forest group-hover:text-white">
          View Profile <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </MotionLink>
  );
}
