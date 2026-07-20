"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Star, MapPin, Users2, CarFront, UtensilsCrossed, Route } from "lucide-react";

import { type Listing } from "@/lib/data";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { ListingCard } from "@/components/home/listing-card";
import { cn, formatPrice, photo } from "@/lib/utils";

/* ============================================================
 * Per-service card styles. Same visual family (radius, shadows, palette),
 * different FORM per service so each homepage section has its own rhythm:
 *  - person   → tour guides (people, portrait-led)
 *  - brand    → travel companies (logo-led trust cards)
 *  - spec     → transport & rentals (compact spec rows)
 *  - journey  → tour packages (wide image itinerary cards)
 *  - food     → restaurants (image-forward tiles)
 * ============================================================ */

export type ServiceCardVariant = "default" | "person" | "brand" | "spec" | "journey" | "food";

function Wrap({ index, children, className }: { index: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      whileHover={{ y: -8 }}
      className={cn("group relative", className)}
    >
      {children}
    </motion.article>
  );
}

function Rating({ rating, reviews, light = false }: { rating: number; reviews?: number; light?: boolean }) {
  return (
    <span className={cn("flex items-center gap-1 text-xs font-semibold", light ? "text-white" : "text-forest")}>
      <Star className="h-3.5 w-3.5 fill-gold text-gold" />
      {rating.toFixed(1)}
      {typeof reviews === "number" && (
        <span className={cn("font-normal", light ? "text-white/75" : "text-muted-foreground")}>({reviews})</span>
      )}
    </span>
  );
}

/* ---------- Tour guides — person card ---------- */
function PersonCard({ listing: l, index }: { listing: Listing; index: number }) {
  return (
    <Wrap index={index} className="flex flex-col items-center rounded-3xl border border-border/70 bg-card p-5 text-center shadow-premium transition-shadow hover:shadow-premium-lg">
      <Link href={`/listings/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
      <span className="grid h-24 w-24 place-items-center overflow-hidden rounded-full ring-4 ring-gold/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(l.image, 300)} alt={l.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
      </span>
      <h3 className="mt-3 font-display text-base font-semibold leading-snug text-forest">
        {l.title} <VerifiedBadge className="h-4 w-4" />
      </h3>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 text-forest-600" /> {l.location}</p>
      <div className="mt-1.5"><Rating rating={l.rating} reviews={l.reviews} /></div>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-xs font-bold text-forest-700">
        <Users2 className="h-3.5 w-3.5 text-forest-600" />
        {l.price > 0 ? `${formatPrice(l.price)} / ${l.unit}` : "Local Guide"}
      </span>
    </Wrap>
  );
}

/* ---------- Travel companies — brand card ---------- */
function BrandCard({ listing: l, index }: { listing: Listing; index: number }) {
  return (
    <Wrap index={index} className="flex flex-col items-center rounded-3xl border border-border/70 bg-card p-5 text-center shadow-premium transition-shadow hover:shadow-premium-lg">
      <Link href={`/listings/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
      <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-border bg-white p-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(l.image, 300)} alt={l.title} loading="lazy" decoding="async" className="h-full w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-105" />
      </span>
      <span className="mt-3 rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-700">{l.categoryLabel}</span>
      <h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-forest">
        {l.title} <VerifiedBadge className="h-4 w-4" />
      </h3>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 text-forest-600" /> {l.location}</p>
      <div className="mt-1.5"><Rating rating={l.rating} reviews={l.reviews} /></div>
      <span className="mt-3 rounded-lg bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-forest-700">View profile</span>
    </Wrap>
  );
}

/* ---------- Transport — compact spec row ---------- */
function SpecCard({ listing: l, index, hidePrice }: { listing: Listing; index: number; hidePrice?: boolean }) {
  return (
    <Wrap index={index} className="flex items-stretch gap-4 rounded-3xl border border-border/70 bg-card p-3 shadow-premium transition-shadow hover:shadow-premium-lg">
      <Link href={`/listings/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
      <span className="h-28 w-32 shrink-0 overflow-hidden rounded-2xl sm:w-36">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(l.image, 400)} alt={l.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-forest-600">
          <CarFront className="h-3 w-3" /> {l.categoryLabel}
        </span>
        <h3 className="mt-1 truncate font-display text-base font-semibold text-forest">
          {l.title} <VerifiedBadge className="h-4 w-4" />
        </h3>
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 text-forest-600" /> {l.location}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Rating rating={l.rating} reviews={l.reviews} />
          {!hidePrice && l.price > 0 && (
            <span className="font-display text-base font-bold text-forest">
              {formatPrice(l.price)} <span className="text-xs font-medium text-muted-foreground">/ {l.unit}</span>
            </span>
          )}
        </div>
      </div>
    </Wrap>
  );
}

/* ---------- Tour packages — wide journey card ---------- */
function JourneyCard({ listing: l, index, hidePrice }: { listing: Listing; index: number; hidePrice?: boolean }) {
  return (
    <Wrap index={index} className="overflow-hidden rounded-3xl shadow-premium transition-shadow hover:shadow-premium-lg">
      <Link href={`/listings/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
      <div className="relative h-56 sm:h-64">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(l.image, 800)} alt={l.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/85 via-forest-900/25 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-900 shadow-gold-glow">
          <Route className="h-3 w-3" /> {l.categoryLabel}
        </span>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold leading-snug text-white">
              {l.title} <VerifiedBadge className="h-4 w-4" />
            </h3>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-white/85">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-gold" /> {l.location}</span>
              <Rating rating={l.rating} reviews={l.reviews} light />
            </p>
          </div>
          {!hidePrice && l.price > 0 && (
            <span className="shrink-0 rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-forest shadow-soft">
              {formatPrice(l.price)} <span className="text-[10px] font-medium text-muted-foreground">/ {l.unit}</span>
            </span>
          )}
        </div>
      </div>
    </Wrap>
  );
}

/* ---------- Restaurants — image-forward food tile ---------- */
function FoodCard({ listing: l, index, hidePrice }: { listing: Listing; index: number; hidePrice?: boolean }) {
  return (
    <Wrap index={index} className="overflow-hidden rounded-3xl shadow-premium transition-shadow hover:shadow-premium-lg">
      <Link href={`/listings/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
      <div className="relative h-52 sm:h-60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(l.image, 500)} alt={l.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/80 via-transparent to-transparent" />
        {!hidePrice && l.price > 0 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-forest shadow-soft">
            <UtensilsCrossed className="h-3 w-3 text-gold-700" /> {formatPrice(l.price)}/{l.unit}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-display text-base font-semibold leading-snug text-white">
            {l.title} <VerifiedBadge className="h-4 w-4" />
          </h3>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-white/85">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-gold" /> {l.location}</span>
            <Rating rating={l.rating} reviews={l.reviews} light />
          </p>
        </div>
      </div>
    </Wrap>
  );
}

/* ---------- Switcher ---------- */

/** The homepage picks a variant per section; browse pages pick per category. */
export function variantForCategory(category: Listing["category"]): ServiceCardVariant {
  if (category === "guides") return "person";
  if (category === "travel-companies") return "brand";
  if (category === "transport") return "spec";
  if (category === "tours") return "journey";
  if (category === "restaurants") return "food";
  return "default";
}

export function ServiceCard({
  listing,
  index = 0,
  hidePrice = false,
  variant,
}: {
  listing: Listing;
  index?: number;
  hidePrice?: boolean;
  variant?: ServiceCardVariant;
}) {
  const v = variant ?? variantForCategory(listing.category);
  if (v === "person") return <PersonCard listing={listing} index={index} />;
  if (v === "brand") return <BrandCard listing={listing} index={index} />;
  if (v === "spec") return <SpecCard listing={listing} index={index} hidePrice={hidePrice} />;
  if (v === "journey") return <JourneyCard listing={listing} index={index} hidePrice={hidePrice} />;
  if (v === "food") return <FoodCard listing={listing} index={index} hidePrice={hidePrice} />;
  return <ListingCard listing={listing} index={index} hidePrice={hidePrice} />;
}

/** Grid column classes tuned per card form. */
export function gridForVariant(v: ServiceCardVariant): string {
  if (v === "spec") return "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5";
  if (v === "journey") return "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5";
  return "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4";
}
