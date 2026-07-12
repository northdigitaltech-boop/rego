"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Star,
  Heart,
  MapPin,
  Database,
  BadgeCheck,
  UtensilsCrossed,
  Clock,
  SlidersHorizontal,
  Search,
  X,
} from "lucide-react";

import { useWishlist } from "@/lib/wishlist";
import { SortBar, sortItems, type SortId } from "@/components/listings/sort-bar";
import { type Listing } from "@/lib/data";
import {
  type RestaurantRow,
  CUISINE_TYPES,
  PRICE_RANGES,
} from "@/lib/restaurants";
import { cn, photo } from "@/lib/utils";

/** Best-effort "open now" — parses "9:00 AM" style hours; unknown ⇒ treated open. */
function toMinutes(t: string | null): number | null {
  if (!t) return null;
  const m = t.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  const ap = (m[3] ?? "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + min;
}
function isOpenNow(open: string | null, close: string | null): boolean {
  const o = toMinutes(open);
  const c = toMinutes(close);
  if (o == null || c == null) return true; // unknown → don't hide
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  return c > o ? cur >= o && cur <= c : cur >= o || cur <= c; // handle past-midnight
}

export function RestaurantCategoryView({
  restaurants,
  heading,
  subheading,
  query = "",
}: {
  restaurants: RestaurantRow[];
  heading: string;
  subheading: string;
  query?: string;
}) {
  const [cuisine, setCuisine] = React.useState("all");
  const [price, setPrice] = React.useState("all");
  const [location, setLocation] = React.useState("all");
  const [minRating, setMinRating] = React.useState("all");
  const [dining, setDining] = React.useState("all");
  const [openNow, setOpenNow] = React.useState(false);
  const [familyOnly, setFamilyOnly] = React.useState(false);
  const [deliveryOnly, setDeliveryOnly] = React.useState(false);
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [link, setLink] = React.useState<"all" | "property" | "independent">("all");
  const [sort, setSort] = React.useState<SortId>("featured");
  const [q, setQ] = React.useState(query);
  const needle = q.trim().toLowerCase();

  const locations = Array.from(new Set(restaurants.map((r) => r.location || r.city).filter(Boolean) as string[])).sort();
  const diningOpts = Array.from(new Set(restaurants.flatMap((r) => r.dining_options ?? []))).sort();

  const shown = sortItems(
    restaurants.filter((r) => {
      if (cuisine !== "all" && !(r.cuisine_types ?? []).includes(cuisine)) return false;
      if (price !== "all" && r.price_range !== price) return false;
      if (location !== "all" && (r.location || r.city) !== location) return false;
      if (minRating !== "all" && Number(r.rating) < Number(minRating)) return false;
      if (dining !== "all" && !(r.dining_options ?? []).includes(dining)) return false;
      if (openNow && !isOpenNow(r.opening_hours, r.closing_hours)) return false;
      if (familyOnly && !((r.facilities ?? []).includes("Family Area") || (r.facilities ?? []).includes("Kids Friendly"))) return false;
      if (deliveryOnly && !(r.dining_options ?? []).includes("Delivery")) return false;
      if (verifiedOnly && !r.verified) return false;
      if (link === "property" && !r.property_id) return false;
      if (link === "independent" && r.property_id) return false;
      if (needle && ![r.name, r.location ?? "", r.city ?? "", (r.cuisine_types ?? []).join(" "), r.property_name ?? ""].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    }),
    sort,
    (r) => ({ price: 0, rating: Number(r.rating), reviews: r.reviews, featured: r.featured })
  );

  return (
    <div className="bg-background">
      <div className="border-b border-border bg-forest-50/50">
        <div className="container-px py-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">{heading}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white"><Database className="h-3.5 w-3.5" /> Live from database</span>
          </div>
          <p className="mt-2 text-muted-foreground">{subheading}</p>
          <div className="mt-4 flex max-w-md items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 shadow-premium">
            <Search className="h-5 w-5 text-forest-600" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${heading.toLowerCase()} by name, cuisine or area…`} className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            {q && (<button onClick={() => setQ("")} aria-label="Clear" className="text-muted-foreground hover:text-forest"><X className="h-4 w-4" /></button>)}
          </div>
        </div>
      </div>

      <div className="container-px py-8">
        <div className="mb-6 rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-forest"><SlidersHorizontal className="h-4 w-4" /> Filters</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Select label="Cuisine" value={cuisine} onChange={setCuisine} options={[["all", "All cuisines"], ...CUISINE_TYPES.map((c) => [c, c] as [string, string])]} />
            <Select label="Price range" value={price} onChange={setPrice} options={[["all", "Any price"], ...PRICE_RANGES.map((p) => [p, p] as [string, string])]} />
            <Select label="Location" value={location} onChange={setLocation} options={[["all", "Anywhere"], ...locations.map((l) => [l, l] as [string, string])]} />
            <Select label="Dining option" value={dining} onChange={setDining} options={[["all", "Any"], ...diningOpts.map((d) => [d, d] as [string, string])]} />
            <Select label="Min rating" value={minRating} onChange={setMinRating} options={[["all", "Any"], ["3", "3★+"], ["4", "4★+"], ["4.5", "4.5★+"]]} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {([["all", "All"], ["independent", "Independent"], ["property", "Hotel / Resort"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setLink(id)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition-all", link === id ? "bg-gradient-forest text-white shadow-soft" : "border border-border bg-card text-forest hover:bg-muted")}>{label}</button>
            ))}
            <Toggle active={openNow} onClick={() => setOpenNow((v) => !v)} label="Open now" />
            <Toggle active={familyOnly} onClick={() => setFamilyOnly((v) => !v)} label="Family friendly" />
            <Toggle active={deliveryOnly} onClick={() => setDeliveryOnly((v) => !v)} label="Delivery" />
            <Toggle active={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)} icon={<BadgeCheck className="h-3.5 w-3.5" />} label="Verified" />
            <span className="ml-auto text-xs text-muted-foreground">{shown.length} restaurant{shown.length === 1 ? "" : "s"}</span>
          </div>
          <SortBar value={sort} onChange={setSort} className="mt-3" />
        </div>

        {shown.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center text-muted-foreground">No restaurants match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((r, i) => <RestaurantCard key={r.id} r={r} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all", active ? "bg-gradient-forest text-white shadow-soft" : "border border-border bg-card text-forest hover:bg-muted")}>{icon}{label}</button>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="auth-input">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}

function RestaurantCard({ r, index }: { r: RestaurantRow; index: number }) {
  const { isWished, toggle } = useWishlist();
  const wished = isWished(r.id);
  const open = isOpenNow(r.opening_hours, r.closing_hours);
  const cover = r.cover_image || r.logo || "";
  const wishItem: Listing = {
    id: r.id,
    title: r.name,
    category: "restaurants",
    categoryLabel: (r.cuisine_types ?? [])[0] || "Restaurant",
    location: r.location || r.city || "Gilgit Baltistan",
    price: 0,
    unit: "",
    rating: Number(r.rating),
    reviews: r.reviews,
    image: cover,
    provider: r.property_name ?? undefined,
    featured: r.featured,
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      whileHover={{ y: -8 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-shadow hover:shadow-premium-lg"
    >
      <Link href={`/listings/${r.id}`} className="absolute inset-0 z-10" aria-label={r.name} />
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(cover)} alt={r.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-soft", open ? "bg-forest-600 text-white" : "bg-red-500 text-white")}>{open ? "Open now" : "Closed"}</span>
          <button aria-label={wished ? "Remove from wishlist" : "Save to wishlist"} onClick={(e) => { e.preventDefault(); toggle(wishItem); }} className={cn("grid h-8 w-8 place-items-center rounded-full bg-white/90 backdrop-blur transition-colors hover:bg-white", wished ? "text-red-500" : "text-forest hover:text-red-500")}><Heart className={cn("h-4 w-4", wished && "fill-red-500")} /></button>
        </div>
        {r.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.logo} alt="" className="absolute bottom-2 left-3 z-20 h-10 w-10 rounded-xl border-2 border-white object-cover shadow-soft" />
        )}
        {r.featured && (<span className="absolute bottom-3 right-3 z-20 rounded-full bg-gradient-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-900 shadow-gold-glow">Featured</span>)}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5">
          <h3 className="font-display text-base font-semibold leading-snug text-forest">{r.name}</h3>
          {r.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-forest-600" />}
        </div>
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-forest-600"><UtensilsCrossed className="h-3.5 w-3.5" /> {(r.cuisine_types ?? []).slice(0, 2).join(", ") || "Restaurant"}</p>
        {r.property_name && <p className="mt-0.5 text-xs text-muted-foreground">at {r.property_name}</p>}
        <div className="mt-1.5 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
          <span className="text-xs font-semibold text-forest">{Number(r.rating).toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">({r.reviews})</span>
          {r.price_range && <span className="ml-2 text-xs text-muted-foreground">· {r.price_range}</span>}
        </div>
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {r.location || r.city || "Gilgit Baltistan"}</p>
        {(r.opening_hours || r.closing_hours) && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {r.opening_hours ?? ""}{r.closing_hours ? ` – ${r.closing_hours}` : ""}</p>
        )}

        <div className="relative z-20 mt-3 flex gap-2">
          <Link href={`/listings/${r.id}`} className="flex-1 rounded-xl border border-border px-3 py-2 text-center text-xs font-semibold text-forest transition-colors hover:bg-muted">View Menu</Link>
          <Link href={`/listings/${r.id}#book`} className="flex-1 rounded-xl bg-gradient-forest px-3 py-2 text-center text-xs font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5">Book Table</Link>
        </div>
      </div>
    </motion.article>
  );
}
