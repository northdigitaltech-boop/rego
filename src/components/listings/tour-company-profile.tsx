"use client";

import * as React from "react";
import Link from "next/link";
import {
  Star,
  MapPin,
  ShieldCheck,
  ChevronLeft,
  CalendarRange,
  Globe,
  Clock,
  Briefcase,
} from "lucide-react";

import { ListingCard } from "@/components/home/listing-card";
import {
  packageToListing,
  transportToListing,
  guideToListing,
  type TourCompanyRow,
  type TourPackageRow,
  type TransportRow,
  type TourGuideRow,
} from "@/lib/tour-companies";
import { providerToListing, type MediaProviderRow } from "@/lib/media";
import { photo } from "@/lib/utils";

export function TourCompanyProfile({
  company,
  packages,
  transports,
  guides,
  media = [],
}: {
  company: TourCompanyRow;
  packages: TourPackageRow[];
  transports: TransportRow[];
  guides: TourGuideRow[];
  media?: MediaProviderRow[];
}) {
  const cover = photo(company.cover_image ?? company.logo ?? "");
  const itemsRef = React.useRef<HTMLDivElement>(null);
  const scrollToItems = () =>
    itemsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="bg-background">
      <div className="container-px pt-6">
        <Link href="/categories/travel-companies" className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 hover:text-gold">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      {/* Cover */}
      <div className="container-px mt-4">
        <div className="relative h-56 overflow-hidden rounded-3xl sm:h-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt={company.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-900/80 to-transparent" />
        </div>
      </div>

      {/* Header */}
      <div className="container-px -mt-12 relative">
        <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card p-5 shadow-premium-lg sm:flex-row sm:items-center">
          <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-white">
            {company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo(company.logo)} alt="" className="h-full w-full object-cover" />
            ) : (
              <Briefcase className="h-8 w-8 text-forest-600" />
            )}
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-forest sm:text-3xl">{company.name}</h1>
              {company.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1 font-semibold text-forest">
                <Star className="h-4 w-4 fill-gold text-gold" />
                {Number(company.rating || 0).toFixed(1)}
                <span className="font-normal text-muted-foreground">({company.reviews} reviews)</span>
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {company.location ?? "Gilgit Baltistan"}
              </span>
              {company.experience_years != null && (
                <span className="text-muted-foreground">{company.experience_years} yrs experience</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={scrollToItems}
              className="flex items-center gap-2 rounded-lg bg-gradient-gold px-5 py-2.5 text-sm font-bold text-forest-900 shadow-gold-glow transition-transform hover:-translate-y-0.5"
            >
              <CalendarRange className="h-4 w-4" /> Book Now
            </button>
          </div>
        </div>
      </div>

      <div className="container-px mt-8 space-y-10 pb-16">
        {/* About */}
        {company.description && (
          <section>
            <h2 className="font-display text-xl font-bold text-forest">About {company.name}</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">{company.description}</p>
          </section>
        )}

        {/* Info chips */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {company.office_address && <InfoChip icon={MapPin} label="Office" value={company.office_address} />}
          {company.opening_hours && <InfoChip icon={Clock} label="Hours" value={company.opening_hours} />}
          {company.service_areas && company.service_areas.length > 0 && (
            <InfoChip icon={MapPin} label="Service areas" value={company.service_areas.join(", ")} />
          )}
          {company.website && <InfoChip icon={Globe} label="Website" value={company.website} href={company.website} />}
        </section>

        {/* Gallery */}
        {company.gallery && company.gallery.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold text-forest">Gallery</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {company.gallery.map((src, i) => (
                <div key={i} className="h-36 overflow-hidden rounded-2xl shadow-premium">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo(src)} alt="" className="h-full w-full object-cover transition-transform hover:scale-105" />
                </div>
              ))}
            </div>
          </section>
        )}

        <div ref={itemsRef} className="space-y-10 scroll-mt-24">
          <Grid title="Tour Packages" items={packages.map(packageToListing)} empty="No packages listed yet." />
          <Grid title="Transport & Vehicles" items={transports.map(transportToListing)} empty="No vehicles listed yet." />
          <Grid title="Tour Guides" items={guides.map(guideToListing)} empty="No guides listed yet." />
          {media.length > 0 && (
            <Grid title="Photographers & Videographers" items={media.map(providerToListing)} empty="" />
          )}
        </div>
      </div>
    </div>
  );
}

function Grid({
  title,
  items,
  empty,
}: {
  title: string;
  items: ReturnType<typeof packageToListing>[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-forest">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function InfoChip({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-premium">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 line-clamp-2 text-sm font-medium text-forest">{value}</p>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
  ) : (
    inner
  );
}
