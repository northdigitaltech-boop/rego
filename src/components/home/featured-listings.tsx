"use client";

import { ChevronRight } from "lucide-react";

import { ListingCard } from "@/components/home/listing-card";
import { listings } from "@/lib/data";

const featured = listings.filter((l) => l.featured).slice(0, 5);

export function FeaturedListings() {
  return (
    <section id="featured" className="bg-background py-10 sm:py-12">
      <div className="container-px">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-forest sm:text-3xl">
            Featured Listings
          </h2>
          <a
            href="/listings"
            className="flex items-center gap-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold"
          >
            View All <ChevronRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {featured.map((listing, i) => (
            <ListingCard key={listing.id} listing={listing} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
