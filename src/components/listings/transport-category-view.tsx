"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Star,
  Heart,
  Users,
  MapPin,
  Database,
  BadgeCheck,
  Bus,
  Car,
  Search,
  X,
} from "lucide-react";

import { useWishlist } from "@/lib/wishlist";
import { SortBar, sortItems, type SortId } from "@/components/listings/sort-bar";
import { type Listing } from "@/lib/data";
import { cn, formatPrice, photo } from "@/lib/utils";

export interface TransportCardItem {
  id: string;
  title: string;
  listingType: "service" | "rental";
  vehicleType: string;
  seats: number | null;
  price: number;
  unit: string;
  location: string;
  provider: string | null;
  verified: boolean;
  featured: boolean;
  rating: number;
  reviews: number;
  image: string;
}

type Filter = "all" | "service" | "rental";

export function TransportCategoryView({
  items,
  heading,
  subheading,
  query = "",
}: {
  items: TransportCardItem[];
  heading: string;
  subheading: string;
  query?: string;
}) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [sort, setSort] = React.useState<SortId>("featured");
  const [q, setQ] = React.useState(query);
  const needle = q.trim().toLowerCase();
  const serviceCount = items.filter((i) => i.listingType === "service").length;
  const rentalCount = items.filter((i) => i.listingType === "rental").length;
  const shown = sortItems(
    items.filter(
      (i) =>
        (filter === "all" || i.listingType === filter) &&
        (!needle ||
          [i.title, i.vehicleType, i.location, i.provider ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(needle))
    ),
    sort,
    (i) => ({ price: i.price, rating: i.rating, reviews: i.reviews, featured: i.featured })
  );

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: items.length },
    { id: "service", label: "Transport Service", count: serviceCount },
    { id: "rental", label: "Vehicle Rental", count: rentalCount },
  ];

  return (
    <div className="bg-background">
      <div className="border-b border-border bg-forest-50/50">
        <div className="container-px py-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">
              {heading}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white">
              <Database className="h-3.5 w-3.5" /> Live from database
            </span>
          </div>
          <p className="mt-2 text-muted-foreground">{subheading}</p>

          <div className="mt-4 flex max-w-md items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 shadow-premium">
            <Search className="h-5 w-5 text-forest-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${heading.toLowerCase()} by vehicle, area or provider…`}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear" className="text-muted-foreground hover:text-forest">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                  filter === t.id
                    ? "bg-gradient-forest text-white shadow-soft"
                    : "border border-border bg-card text-forest hover:bg-muted"
                )}
              >
                {t.id === "service" && <Bus className="h-4 w-4" />}
                {t.id === "rental" && <Car className="h-4 w-4" />}
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-bold",
                    filter === t.id ? "bg-white/20" : "bg-muted text-muted-foreground"
                  )}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <SortBar value={sort} onChange={setSort} className="mt-3" />
        </div>
      </div>

      <div className="container-px py-8">
        {shown.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center text-muted-foreground">
            No vehicles available in this category yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((item, i) => (
              <TransportCard key={item.id} item={item} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransportCard({ item, index }: { item: TransportCardItem; index: number }) {
  const { isWished, toggle } = useWishlist();
  const wished = isWished(item.id);
  const isRental = item.listingType === "rental";

  const wishItem: Listing = {
    id: item.id,
    title: item.title,
    category: "transport",
    categoryLabel: isRental ? "Vehicle Rental" : "Transport Service",
    location: item.location,
    price: item.price,
    unit: item.unit,
    rating: item.rating,
    reviews: item.reviews,
    image: item.image,
    provider: item.provider ?? undefined,
    featured: item.featured,
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      whileHover={{ y: -8 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-shadow hover:shadow-premium-lg"
    >
      <Link href={`/listings/${item.id}`} className="absolute inset-0 z-10" aria-label={item.title} />
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo(item.image)}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-soft",
              isRental ? "bg-gold text-forest-900" : "bg-gradient-forest text-white"
            )}
          >
            {isRental ? "Vehicle Rental" : "Transport Service"}
          </span>
          <button
            aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
            onClick={(e) => {
              e.preventDefault();
              toggle(wishItem);
            }}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full bg-white/90 backdrop-blur transition-colors hover:bg-white",
              wished ? "text-red-500" : "text-forest hover:text-red-500"
            )}
          >
            <Heart className={cn("h-4 w-4", wished && "fill-red-500")} />
          </button>
        </div>
        {item.featured && (
          <span className="absolute bottom-3 left-3 z-20 rounded-full bg-gradient-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-900 shadow-gold-glow">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold leading-snug text-forest">
            {item.title}
          </h3>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-forest-600">{item.vehicleType}</span>
          {item.seats != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {item.seats} seats
            </span>
          )}
        </div>

        {item.provider && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-forest-600">
            by {item.provider}
            {item.verified && <BadgeCheck className="h-3.5 w-3.5 text-forest-600" />}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
          <span className="text-xs font-semibold text-forest">{item.rating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">({item.reviews})</span>
        </div>

        <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {item.location}
        </p>

        <div className="mt-3 flex items-end gap-1 pt-1">
          <span className="font-display text-lg font-bold text-forest">
            {formatPrice(item.price)}
          </span>
          <span className="pb-0.5 text-xs text-muted-foreground">/ {item.unit}</span>
        </div>

        <div className="relative z-20 mt-3 flex gap-2">
          <Link
            href={`/listings/${item.id}`}
            className="flex-1 rounded-xl border border-border px-3 py-2 text-center text-xs font-semibold text-forest transition-colors hover:bg-muted"
          >
            View Details
          </Link>
          <Link
            href={`/listings/${item.id}#book`}
            className="flex-1 rounded-xl bg-gradient-forest px-3 py-2 text-center text-xs font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5"
          >
            Book Now
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
