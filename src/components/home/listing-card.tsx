"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Star, Heart } from "lucide-react";

import { type Listing } from "@/lib/data";
import { useWishlist } from "@/lib/wishlist";
import { cn, formatPrice, photo } from "@/lib/utils";

export function ListingCard({
  listing,
  index = 0,
  hidePrice = false,
  className,
}: {
  listing: Listing;
  index?: number;
  hidePrice?: boolean;
  className?: string;
}) {
  const { isWished, toggle } = useWishlist();
  const wished = isWished(listing.id);
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      whileHover={{ y: -8 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-shadow hover:shadow-premium-lg",
        className
      )}
    >
      <Link
        href={`/listings/${listing.id}`}
        className="absolute inset-0 z-10"
        aria-label={listing.title}
      />
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo(listing.image)}
          alt={`${listing.title}${listing.location ? ` in ${listing.location}` : ""}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
          {listing.featured && (
            <span className="rounded-full bg-gradient-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-900 shadow-gold-glow">
              Featured
            </span>
          )}
          <button
            aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
            onClick={(e) => {
              e.preventDefault();
              toggle(listing);
            }}
            className={cn(
              "ml-auto grid h-8 w-8 place-items-center rounded-full bg-white/90 backdrop-blur transition-colors hover:bg-white",
              wished ? "text-red-500" : "text-forest hover:text-red-500"
            )}
          >
            <Heart className={cn("h-4 w-4", wished && "fill-red-500")} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-semibold leading-snug text-forest">
          {listing.title}
        </h3>

        {listing.provider && (
          <p className="mt-0.5 text-xs font-medium text-forest-600">
            by {listing.provider}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, j) => (
              <Star
                key={j}
                className={
                  j < Math.round(listing.rating)
                    ? "h-3.5 w-3.5 fill-gold text-gold"
                    : "h-3.5 w-3.5 text-border"
                }
              />
            ))}
          </span>
          <span className="text-xs font-semibold text-forest">
            {listing.rating.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({listing.reviews})
          </span>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">{listing.location}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {!hidePrice && listing.price > 0 ? (
            <div className="flex items-end gap-1">
              <span className="font-display text-lg font-bold text-forest">
                {formatPrice(listing.price)}
              </span>
              <span className="pb-0.5 text-xs text-muted-foreground">
                / {listing.unit}
              </span>
            </div>
          ) : (
            <span />
          )}
          <Link
            href={`/listings/${listing.id}`}
            aria-label={`View more about ${listing.title}`}
            className="relative z-20 shrink-0 rounded-lg bg-forest-800 px-3 py-1.5 text-xs font-semibold text-white shadow-soft transition-colors hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            View more
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
