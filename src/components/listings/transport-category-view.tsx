"use client";

import * as React from "react";
import Link from "next/link";
import {
  Star,
  Heart,
  Users,
  MapPin,
  BadgeCheck,
  Bus,
  Car,
  Search,
  X,
  Cog,
  Snowflake,
  Fuel,
  Luggage,
  UserRound,
} from "lucide-react";

import { useWishlist } from "@/lib/wishlist";
import { SortBar, sortItems, type SortId } from "@/components/listings/sort-bar";
import { type Listing } from "@/lib/data";
import { cn, formatPrice, photo } from "@/lib/utils";
import { Rating } from "@/components/ui/rating";

/** One small spec badge. Kept tiny so five fit on a phone-width card. */
function Spec({
  icon: Icon,
  label,
  tone = "muted",
}: {
  icon: typeof Users;
  label: string;
  tone?: "muted" | "forest";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "forest"
          ? "bg-forest-600 text-white"
          : "bg-muted text-forest/80"
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

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
  /* Specs shown as badges — all optional, a blank one simply isn't shown. */
  transmission?: string | null;
  ac?: boolean;
  fuelType?: string | null;
  luggage?: string | null;
  driverIncluded?: boolean;
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

  /* Since rentals moved to their own category, each page carries one kind
     and the tab row is three buttons that all show the same grid — two of
     them reading "0". Show it only when there is genuinely something to
     switch between, which also tidies the Transport page on a day when
     nothing but services is listed. */
  const showTabs = serviceCount > 0 && rentalCount > 0;

  return (
    <div className="bg-background">
      <div className="border-b border-border bg-forest-50/50">
        <div className="container-px py-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">
              {heading}
            </h1>
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

          <div className={cn("mt-4 flex-wrap gap-2", showTabs ? "flex" : "hidden")}>
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
            {shown.map((item) => (
              <TransportCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransportCard({ item }: { item: TransportCardItem; }) {
  const { isWished, toggle } = useWishlist();
  const wished = isWished(item.id);
  const isRental = item.listingType === "rental";

  const wishItem: Listing = {
    id: item.id,
    title: item.title,
    /* The saved wishlist item has to carry the category the listing really
       belongs to — it is what the wishlist page filters and links by, so a
       rental filed under transport would come back pointing at a page it
       is not on. */
    category: isRental ? "vehicle-rental" : "transport",
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
    <article
      className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-2 group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-shadow hover:shadow-premium-lg"
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
        <p className="mt-1 text-xs font-medium text-forest-600">{item.vehicleType}</p>

        {item.provider && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-forest-600">
            by {item.provider}
          </p>
        )}

        {/* Spec badges — the details people actually choose between.
            Every one is conditional, so a half-filled listing degrades to
            fewer badges rather than to "Automatic: unknown". */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Rating
            value={item.rating}
            reviews={item.reviews}
            showCount
            className="rounded-full bg-forest-50 px-2 py-0.5 text-xs"
          />
          {item.verified && (
            <Spec icon={BadgeCheck} label="Verified Owner" tone="forest" />
          )}
          {item.seats != null && item.seats > 0 && (
            <Spec icon={Users} label={`${item.seats} Seats`} />
          )}
          {item.transmission && <Spec icon={Cog} label={item.transmission} />}
          {item.ac && <Spec icon={Snowflake} label="Air Conditioned" />}
          {item.fuelType && <Spec icon={Fuel} label={item.fuelType} />}
          {item.luggage && <Spec icon={Luggage} label={item.luggage} />}
          {item.driverIncluded && <Spec icon={UserRound} label="Driver included" />}
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
    </article>
  );
}
