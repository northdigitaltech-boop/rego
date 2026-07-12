"use client";

import * as React from "react";
import Link from "next/link";
import { Star, MapPin, ShieldCheck, Briefcase, Search, X } from "lucide-react";

import { SortBar, sortItems, type SortId } from "@/components/listings/sort-bar";
import { type TourCompanyRow } from "@/lib/tour-companies";
import { photo } from "@/lib/utils";

export function CompanyCategoryView({
  companies,
  heading,
  subheading,
  query = "",
}: {
  companies: TourCompanyRow[];
  heading: string;
  subheading: string;
  query?: string;
}) {
  const [sort, setSort] = React.useState<SortId>("featured");
  const [q, setQ] = React.useState(query);
  const sorted = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? companies.filter((c) =>
          [c.name, c.location ?? "", c.description ?? "", (c.service_areas ?? []).join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
      : companies;
    return sortItems(base, sort, (c) => ({
      price: 0,
      rating: Number(c.rating || 0),
      reviews: c.reviews,
      featured: c.featured,
    }));
  }, [companies, sort, q]);

  return (
    <div className="container-px py-10">
      <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">
        {heading}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{subheading}</p>
      <div className="mt-4 flex max-w-md items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 shadow-premium">
        <Search className="h-5 w-5 text-forest-600" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${heading.toLowerCase()} by name or area…`}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear" className="text-muted-foreground hover:text-forest">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <SortBar value={sort} onChange={setSort} className="mt-4" />

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((c) => (
          <Link
            key={c.id}
            href={`/listings/${c.id}`}
            className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-shadow hover:shadow-premium-lg"
          >
            <div className="relative h-40 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo(c.cover_image ?? c.logo ?? "")}
                alt={c.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              {c.verified && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-forest-600 backdrop-blur">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white">
                  {c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo(c.logo)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Briefcase className="h-5 w-5 text-forest-600" />
                  )}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-semibold text-forest">
                    {c.name}
                  </h3>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {c.location ?? "Gilgit Baltistan"}
                  </p>
                </div>
              </div>
              {c.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {c.description}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between pt-1">
                <span className="flex items-center gap-1 text-sm font-semibold text-forest">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  {Number(c.rating || 0).toFixed(1)}
                  <span className="font-normal text-muted-foreground">
                    ({c.reviews})
                  </span>
                </span>
                {c.experience_years != null && (
                  <span className="text-xs text-muted-foreground">
                    {c.experience_years} yrs experience
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
