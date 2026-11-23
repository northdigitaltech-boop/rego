/* ------------------------------------------------------------------
   NOT a client component, and that is the point.

   This file had "use client" at the top, so all five card variants —
   PersonCard, BrandCard, SpecCard, JourneyCard, FoodCard — were
   shipped to the browser and hydrated. The homepage renders 59 cards.
   None of this file needs the client: no state, no effects, no event
   handlers, nothing touching window or localStorage. It is markup.

   The two client pieces it renders stay client and are unaffected:
   Reveal (its scroll fade) and ListingCard (the wishlist heart) carry
   their own "use client". A server component rendering a client child
   is fine — only the reverse is not.

   Anything that genuinely needs interactivity belongs in its own small
   client component, the way ListingCard already does, rather than
   pulling the whole card system across the boundary with it.
   ------------------------------------------------------------------ */

import Link from "next/link";
import { Star, MapPin, Users2, CarFront, UtensilsCrossed, Route } from "lucide-react";

import { type Listing } from "@/lib/data";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { ListingCard } from "@/components/home/listing-card";
import { cn, formatPrice, photo } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";

/* ============================================================
 * Per-service card styles. Same visual family (radius, shadows, palette),
 * different FORM per service so each homepage section has its own rhythm:
 *  - person   → tour guides (people, portrait-led)
 *  - brand    → travel companies (logo-led trust cards)
 *  - spec     → transport & rentals (compact spec rows)
 *  - journey  → tour packages (wide image itinerary cards)
 *  - food     → restaurants (image-forward tiles)
 * ============================================================ */

import { type ServiceCardVariant } from "@/components/home/service-card-variants";

/* Wrap used to compute a framer-motion delay from index. Reveal takes the
   same index and staggers with a CSS transition-delay instead. */
function Wrap({ index, children, className }: { index: number; children: React.ReactNode; className?: string }) {
  return (
    <Reveal index={index}>
      <article
        className={cn(
          "motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-2",
          "group relative h-full",
          className
        )}
      >
        {children}
      </article>
    </Reveal>
  );
}

function Rating({ rating, reviews, light = false }: { rating: number; reviews?: number; light?: boolean }) {
  // No real reviews yet → show "New" instead of an invented score.
  const hasReviews = (reviews ?? 0) > 0 && rating > 0;
  /* Nothing at all until there is a real review. "No reviews yet" on every
     card (34 times on the homepage) only advertised that nobody had rated
     anything. */
  if (!hasReviews) return null;
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
      <Link prefetch={false} href={`/listings/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
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
      <Link prefetch={false} href={`/listings/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
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
    <Wrap index={index} className="flex items-stretch gap-4 rounded-3xl border border-border/70 bg-card p-3 shadow-premium transition-shadow hover:shadow-premium-lg sm:gap-5 sm:p-4">
      <Link prefetch={false} href={`/listings/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
      {/* Image is a flexible share of the card (never a fixed width), so the
          text column always has room and can't spill outside the card. */}
      <span className="h-32 w-[38%] max-w-[224px] shrink-0 overflow-hidden rounded-2xl sm:h-40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(l.image, 500)} alt={l.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <span className="inline-flex w-fit max-w-full items-center gap-1 truncate rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-forest-600">
          <CarFront className="h-3 w-3 shrink-0" /> {l.categoryLabel}
        </span>
        <h3 className="mt-1.5 line-clamp-2 font-display text-base font-semibold text-forest sm:text-lg">
          {l.title} <VerifiedBadge className="h-4 w-4" />
        </h3>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-forest-600" /> {l.location}
        </p>
        <div className="mt-1.5"><Rating rating={l.rating} reviews={l.reviews} /></div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-2 pt-3">
          <span className="rounded-lg bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-forest-700">
            View details
          </span>
          {!hidePrice && l.price > 0 && (
            <span className="whitespace-nowrap font-display text-base font-bold text-forest sm:text-lg">
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
      <Link prefetch={false} href={`/listings/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
      <div className="relative h-56 sm:h-64">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(l.image, 800)} alt={l.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/85 via-forest-900/25 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-900 shadow-gold-glow">
          <Route className="h-3 w-3" /> {l.categoryLabel}
        </span>
        {/* ------------------------------------------------------------
            This block is anchored to the BOTTOM of a fixed-height card,
            so anything it cannot fit grows upwards — out of the card,
            over the category badge and off the image.

            An unclamped title is all it takes: one provider pasted a
            whole itinerary into the title field and it rendered as
            twenty lines across the artwork. Clamping is the fix, but
            the badge is deliberately a sibling of the clamped text
            rather than inside it, or a long title would clip the
            verified mark away with the overflow.
            ------------------------------------------------------------ */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0">
            <h3 className="flex items-start gap-1 font-display text-lg font-semibold leading-snug text-white">
              <span className="line-clamp-2">{l.title}</span>
              <VerifiedBadge className="mt-0.5 h-4 w-4" />
            </h3>
            {/* Wraps rather than squeezing the rating out of view when the
                place name is long — "SWAT VALLEY — KALAM & MALAM JABBA"
                is one line on a laptop and two on a phone. */}
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/85">
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0 text-gold" />
                <span className="truncate">{l.location}</span>
              </span>
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
      <Link prefetch={false} href={`/listings/${l.id}`} className="absolute inset-0 z-10" aria-label={l.title} />
      <div className="relative h-52 sm:h-60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(l.image, 500)} alt={l.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/80 via-transparent to-transparent" />
        {!hidePrice && l.price > 0 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-forest shadow-soft">
            <UtensilsCrossed className="h-3 w-3 text-gold-700" /> {formatPrice(l.price)}/{l.unit}
          </span>
        )}
        {/* Same bottom-anchored overlay, same clamp — see JourneyCard above. */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="flex items-start gap-1 font-display text-base font-semibold leading-snug text-white">
            <span className="line-clamp-2">{l.title}</span>
            <VerifiedBadge className="mt-0.5 h-4 w-4" />
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/85">
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0 text-gold" />
              <span className="truncate">{l.location}</span>
            </span>
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
  // A rental is still a vehicle — same spec card, different category.
  if (category === "transport" || category === "vehicle-rental") return "spec";
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
  return <ListingCard listing={listing} hidePrice={hidePrice} />;
}

/* gridForVariant and ServiceCardVariant moved to ./service-card-variants,
   which has no "use client" — a server component cannot import a function
   from a client module. Re-exported here so existing imports keep working. */
export { gridForVariant, type ServiceCardVariant } from "@/components/home/service-card-variants";
