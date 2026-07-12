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
  Languages,
  Award,
  Briefcase,
  SlidersHorizontal,
  Search,
  X,
} from "lucide-react";

import { useWishlist } from "@/lib/wishlist";
import { SortBar, sortItems, type SortId } from "@/components/listings/sort-bar";
import { type Listing } from "@/lib/data";
import { type TourGuideRow } from "@/lib/tour-companies";
import { cn, formatPrice, photo } from "@/lib/utils";

const WHATSAPP_FALLBACK = "923001234567";

export function GuideCategoryView({
  guides,
  heading,
  subheading,
  query = "",
}: {
  guides: TourGuideRow[];
  heading: string;
  subheading: string;
  query?: string;
}) {
  const [type, setType] = React.useState("all");
  const [language, setLanguage] = React.useState("all");
  const [location, setLocation] = React.useState("all");
  const [maxPrice, setMaxPrice] = React.useState("all");
  const [minRating, setMinRating] = React.useState("all");
  const [minExp, setMinExp] = React.useState("all");
  const [link, setLink] = React.useState<"all" | "company" | "independent">("all");
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [availableOnly, setAvailableOnly] = React.useState(false);
  const [sort, setSort] = React.useState<SortId>("featured");
  const [q, setQ] = React.useState(query);
  const needle = q.trim().toLowerCase();

  const typeOf = (g: TourGuideRow) => g.guide_type || g.specialization || "Guide";

  const types = Array.from(new Set(guides.map(typeOf))).sort();
  const languages = Array.from(
    new Set(guides.flatMap((g) => g.languages ?? []))
  ).sort();
  const locations = Array.from(
    new Set(guides.map((g) => g.location || g.city).filter(Boolean) as string[])
  ).sort();

  const shown = guides.filter((g) => {
    if (type !== "all" && typeOf(g) !== type) return false;
    if (language !== "all" && !(g.languages ?? []).includes(language)) return false;
    if (location !== "all" && (g.location || g.city) !== location) return false;
    if (maxPrice !== "all" && g.price_per_day > Number(maxPrice)) return false;
    if (minRating !== "all" && Number(g.rating) < Number(minRating)) return false;
    if (minExp !== "all" && (g.experience_years ?? 0) < Number(minExp)) return false;
    if (link === "company" && !g.company_id) return false;
    if (link === "independent" && g.company_id) return false;
    if (verifiedOnly && !g.verified) return false;
    if (availableOnly && g.availability_status !== "available") return false;
    if (
      needle &&
      ![g.name, g.location ?? "", g.city ?? "", (g.areas ?? []).join(" "), g.company_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    )
      return false;
    return true;
  });
  const sorted = sortItems(shown, sort, (g) => ({
    price: g.price_per_day,
    rating: Number(g.rating),
    reviews: g.reviews,
    featured: g.featured,
  }));

  return (
    <div className="bg-background">
      <div className="border-b border-border bg-forest-50/50">
        <div className="container-px py-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">{heading}</h1>
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
              placeholder={`Search ${heading.toLowerCase()} by name, area or company…`}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear" className="text-muted-foreground hover:text-forest">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container-px py-8">
        {/* Filters */}
        <div className="mb-6 rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-forest">
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Select label="Guide type" value={type} onChange={setType} options={[["all", "All types"], ...types.map((t) => [t, t] as [string, string])]} />
            <Select label="Language" value={language} onChange={setLanguage} options={[["all", "Any language"], ...languages.map((l) => [l, l] as [string, string])]} />
            <Select label="Location" value={location} onChange={setLocation} options={[["all", "Anywhere"], ...locations.map((l) => [l, l] as [string, string])]} />
            <Select label="Max price / day" value={maxPrice} onChange={setMaxPrice} options={[["all", "Any price"], ["5000", "Up to 5,000"], ["10000", "Up to 10,000"], ["20000", "Up to 20,000"], ["50000", "Up to 50,000"]]} />
            <Select label="Min rating" value={minRating} onChange={setMinRating} options={[["all", "Any"], ["3", "3★+"], ["4", "4★+"], ["4.5", "4.5★+"]]} />
            <Select label="Min experience" value={minExp} onChange={setMinExp} options={[["all", "Any"], ["1", "1+ yrs"], ["3", "3+ yrs"], ["5", "5+ yrs"], ["10", "10+ yrs"]]} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {([["all", "All guides"], ["company", "Company guides"], ["independent", "Independent guides"]] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setLink(id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                  link === id ? "bg-gradient-forest text-white shadow-soft" : "border border-border bg-card text-forest hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setVerifiedOnly((v) => !v)}
              className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all", verifiedOnly ? "bg-gradient-forest text-white shadow-soft" : "border border-border bg-card text-forest hover:bg-muted")}
            >
              <BadgeCheck className="h-3.5 w-3.5" /> Verified
            </button>
            <button
              onClick={() => setAvailableOnly((v) => !v)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition-all", availableOnly ? "bg-gradient-forest text-white shadow-soft" : "border border-border bg-card text-forest hover:bg-muted")}
            >
              Available now
            </button>
            <span className="ml-auto text-xs text-muted-foreground">{shown.length} guide{shown.length === 1 ? "" : "s"}</span>
          </div>
          <SortBar value={sort} onChange={setSort} className="mt-3" />
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center text-muted-foreground">
            No guides match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((g, i) => (
              <GuideCard key={g.id} guide={g} index={i} typeLabel={typeOf(g)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="auth-input">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function GuideCard({ guide, index, typeLabel }: { guide: TourGuideRow; index: number; typeLabel: string }) {
  const { isWished, toggle } = useWishlist();
  const wished = isWished(guide.id);

  const wishItem: Listing = {
    id: guide.id,
    title: guide.name,
    category: "guides",
    categoryLabel: `${typeLabel} Guide`,
    location: guide.location || guide.city || "Gilgit Baltistan",
    price: guide.price_per_day,
    unit: "day",
    rating: Number(guide.rating),
    reviews: guide.reviews,
    image: guide.image || "",
    provider: guide.company_name ?? undefined,
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
      <Link href={`/listings/${guide.id}`} className="absolute inset-0 z-10" aria-label={guide.name} />
      <div className="relative h-48 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(guide.image || "")} alt={guide.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
          <span className="rounded-full bg-gradient-forest px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-soft">
            {typeLabel}
          </span>
          <button
            aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
            onClick={(e) => { e.preventDefault(); toggle(wishItem); }}
            className={cn("grid h-8 w-8 place-items-center rounded-full bg-white/90 backdrop-blur transition-colors hover:bg-white", wished ? "text-red-500" : "text-forest hover:text-red-500")}
          >
            <Heart className={cn("h-4 w-4", wished && "fill-red-500")} />
          </button>
        </div>
        {guide.featured && (
          <span className="absolute bottom-3 left-3 z-20 rounded-full bg-gradient-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-900 shadow-gold-glow">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5">
          <h3 className="font-display text-base font-semibold leading-snug text-forest">{guide.name}</h3>
          {guide.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-forest-600" />}
        </div>
        {guide.company_name && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-forest-600">
            <Briefcase className="h-3.5 w-3.5" /> {guide.company_name}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
          <span className="text-xs font-semibold text-forest">{Number(guide.rating).toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">({guide.reviews})</span>
          {guide.experience_years != null && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Award className="h-3.5 w-3.5" /> {guide.experience_years} yrs
            </span>
          )}
        </div>

        {guide.languages && guide.languages.length > 0 && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Languages className="h-3.5 w-3.5" /> {guide.languages.slice(0, 3).join(", ")}
          </p>
        )}
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {(guide.areas && guide.areas.length > 0 ? guide.areas.slice(0, 2).join(", ") : guide.location) || "Gilgit Baltistan"}
        </p>

        <div className="mt-3 flex items-end gap-1 pt-1">
          <span className="text-xs text-muted-foreground">from</span>
          <span className="font-display text-lg font-bold text-forest">{formatPrice(guide.price_per_day)}</span>
          <span className="pb-0.5 text-xs text-muted-foreground">/ day</span>
        </div>

        <div className="relative z-20 mt-3 flex gap-2">
          <Link href={`/listings/${guide.id}`} className="flex-1 rounded-xl border border-border px-3 py-2 text-center text-xs font-semibold text-forest transition-colors hover:bg-muted">
            View Profile
          </Link>
          <Link href={`/listings/${guide.id}#book`} className="flex-1 rounded-xl bg-gradient-forest px-3 py-2 text-center text-xs font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5">
            Book Now
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
