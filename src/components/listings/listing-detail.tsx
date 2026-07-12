"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Star,
  MapPin,
  ChevronLeft,
  Check,
  Heart,
  Share2,
  ShieldCheck,
  CalendarRange,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/home/listing-card";
import { listings, type Listing, type CategorySlug } from "@/lib/data";
import { cn, formatPrice, photo } from "@/lib/utils";

const defaultHighlights = [
  "Trusted local provider",
  "Transparent pricing",
  "Verified & reviewed",
  "Flexible booking",
  "24/7 support",
  "Best-price promise",
];

const highlightsByCategory: Partial<Record<CategorySlug, string[]>> = {
  hotels: [
    "Mountain-view rooms",
    "Free Wi-Fi & breakfast",
    "On-site restaurant",
    "24/7 room service",
    "Free parking",
    "Central heating",
  ],
  homestays: [
    "Welcoming local host",
    "Home-cooked meals",
    "Cozy private rooms",
    "Garden & terrace",
    "Free Wi-Fi",
    "Evening bonfire",
  ],
  tours: [
    "Expert local guide",
    "All transport included",
    "Meals & permits covered",
    "Small group sizes",
    "Hotel pickup & drop-off",
    "Flexible itinerary",
  ],
  transport: [
    "Experienced driver",
    "Fuel included",
    "Air-conditioned vehicle",
    "Airport pickup",
    "Flexible routes",
    "24/7 availability",
  ],
  guides: [
    "Licensed local guide",
    "Speaks multiple languages",
    "History & culture expert",
    "Custom itineraries",
    "Photography assistance",
    "Years of experience",
  ],
  photographers: [
    "Professional camera & drone",
    "Same-day previews",
    "Edited high-res photos",
    "Travels with your group",
    "Custom packages",
    "Fast delivery",
  ],
  activities: [
    "Certified instructors",
    "All gear provided",
    "Safety briefing",
    "Small groups",
    "Photos included",
    "Unforgettable views",
  ],
  visa: [
    "Document checklist",
    "Full application handling",
    "Embassy guidance",
    "Fast processing",
    "Regular status updates",
    "Expert support",
  ],
  more: [
    "Trusted local partner",
    "Flexible booking",
    "Best-price promise",
    "24/7 support",
    "Verified service",
    "Easy cancellation",
  ],
};

function buildGallery(listing: Listing) {
  const n = parseInt(listing.id.replace(/\D/g, ""), 10) || 1;
  return [
    listing.image,
    `https://loremflickr.com/900/600/gilgit,mountains?lock=${n + 50}`,
    `https://loremflickr.com/900/600/valley,landscape?lock=${n + 70}`,
    `https://loremflickr.com/900/600/lake,nature?lock=${n + 90}`,
  ].map(photo);
}

function nightsBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return diff > 0 ? Math.round(diff) : 0;
}

export function ListingDetail({ listing }: { listing: Listing }) {
  const gallery = React.useMemo(() => buildGallery(listing), [listing]);
  const [activeImg, setActiveImg] = React.useState(0);
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [guests, setGuests] = React.useState(1);
  const [booked, setBooked] = React.useState(false);

  const perNight = listing.unit === "night";
  const perPerson = listing.unit === "person";
  const nights = nightsBetween(checkIn, checkOut);

  let qty = 1;
  if (perNight) qty = nights || 1;
  if (perPerson) qty = guests;
  const total = listing.price * qty;

  const highlights = highlightsByCategory[listing.category] ?? defaultHighlights;
  const similar = listings
    .filter((l) => l.category === listing.category && l.id !== listing.id)
    .slice(0, 3);

  return (
    <div className="bg-background">
      <div className="container-px py-6">
        <Link
          href="/listings"
          className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 transition-colors hover:text-gold"
        >
          <ChevronLeft className="h-4 w-4" /> Back to listings
        </Link>

        {/* Title row */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="rounded-md bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-600">
              {listing.categoryLabel}
            </span>
            <h1 className="mt-2 font-display text-3xl font-bold text-forest sm:text-4xl">
              {listing.title}
            </h1>
            {listing.provider && (
              <p className="mt-1 text-sm font-medium text-forest-600">
                Provided by {listing.provider}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1 font-semibold text-forest">
                <Star className="h-4 w-4 fill-gold text-gold" />
                {listing.rating.toFixed(1)}
                <span className="font-normal text-muted-foreground">
                  ({listing.reviews} reviews)
                </span>
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {listing.location}, Gilgit Baltistan
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-forest hover:bg-muted">
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-forest hover:bg-muted">
              <Heart className="h-4 w-4" /> Save
            </button>
          </div>
        </div>

        {/* Gallery */}
        <div className="mt-6 grid gap-3 lg:grid-cols-[2fr_1fr]">
          <motion.div
            key={activeImg}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="relative h-72 overflow-hidden rounded-2xl shadow-premium sm:h-[420px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gallery[activeImg]}
              alt={listing.title}
              className="h-full w-full object-cover"
            />
          </motion.div>
          <div className="grid grid-cols-4 gap-3 lg:grid-cols-1">
            {gallery.map((src, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={cn(
                  "relative h-20 overflow-hidden rounded-xl shadow-premium transition-all lg:h-[132px]",
                  activeImg === i
                    ? "ring-2 ring-gold ring-offset-2"
                    : "opacity-80 hover:opacity-100"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <h2 className="font-display text-xl font-bold text-forest">
              About this {listing.categoryLabel.toLowerCase()}
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {listing.title} is one of {listing.location}&apos;s most loved options
              for travelers exploring Gilgit Baltistan. Verified by Rego and
              rated {listing.rating.toFixed(1)} by {listing.reviews} guests, it
              combines comfort, authentic local hospitality and unforgettable
              mountain surroundings.
            </p>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Book securely through Rego with transparent pricing, no hidden
              charges and 24/7 support throughout your trip.
            </p>

            <h2 className="mt-8 font-display text-xl font-bold text-forest">
              What&apos;s included
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {highlights.map((h) => (
                <div key={h} className="flex items-center gap-2.5 text-sm text-forest">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-600">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {h}
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-forest-50/60 p-4">
              <ShieldCheck className="h-8 w-8 shrink-0 text-forest-600" />
              <p className="text-sm text-forest">
                <span className="font-semibold">Verified by Rego.</span> This
                provider is a trusted local partner with confirmed reviews.
              </p>
            </div>
          </div>

          {/* Booking box */}
          <div>
            <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg">
              <div className="flex items-end gap-1">
                <span className="font-display text-2xl font-bold text-forest">
                  {formatPrice(listing.price)}
                </span>
                <span className="pb-1 text-sm text-muted-foreground">
                  / {listing.unit}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {perNight && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Check-in">
                      <input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        className="w-full bg-transparent text-sm text-forest focus:outline-none"
                      />
                    </Field>
                    <Field label="Check-out">
                      <input
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        className="w-full bg-transparent text-sm text-forest focus:outline-none"
                      />
                    </Field>
                  </div>
                )}

                {(perPerson || perNight) && (
                  <Field label="Guests">
                    <select
                      value={guests}
                      onChange={(e) => setGuests(Number(e.target.value))}
                      className="w-full bg-transparent text-sm text-forest focus:outline-none"
                    >
                      {Array.from({ length: 10 }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1} {i === 0 ? "Guest" : "Guests"}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {formatPrice(listing.price)} × {qty} {listing.unit}
                    {qty > 1 ? "s" : ""}
                  </span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between font-display text-base font-bold text-forest">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <Button
                variant="gold"
                size="lg"
                className="mt-5 w-full rounded-lg"
                onClick={() => setBooked(true)}
              >
                {booked ? "Request sent ✓" : "Reserve now"}
              </Button>

              {booked ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm text-forest-600">
                  <CalendarRange className="h-4 w-4" />
                  Booking request received — we&apos;ll be in touch.
                </p>
              ) : (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  You won&apos;t be charged yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Similar */}
        {similar.length > 0 && (
          <div className="mt-14">
            <h2 className="mb-6 font-display text-2xl font-bold text-forest">
              Similar listings
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((l, i) => (
                <ListingCard key={l.id} listing={l} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-lg border border-border px-3 py-2">
      <span className="block text-xs font-semibold text-forest">{label}</span>
      {children}
    </label>
  );
}
