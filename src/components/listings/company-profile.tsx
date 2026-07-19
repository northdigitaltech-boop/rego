"use client";

import * as React from "react";
import Link from "next/link";
import {
  Star,
  MapPin,
  ShieldCheck,
  BadgeCheck,
  ChevronLeft,
  Share2,
  Heart,
  Phone,
  Mail,
  MessageCircle,
  Facebook,
  Instagram,
  Youtube,
  Play,
  Clock,
  Car,
  CalendarDays,
  Users,
  ThumbsUp,
  Headset,
  Map as MapIcon,
  Smile,
  Check,
  Users2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GalleryGrid } from "@/components/listings/profile-gallery";
import { type Listing } from "@/lib/data";
import { cn, formatPrice, photo } from "@/lib/utils";


type Variant = "transport" | "travel-companies";

const fleet = [
  { name: "Toyota Land Cruiser Prado", seats: 7, fuel: "Diesel", price: 28000 },
  { name: "Toyota Land Cruiser 200", seats: 7, fuel: "Diesel", price: 30000 },
  { name: "Toyota Hiace Grand Cabin", seats: 14, fuel: "Diesel", price: 22000 },
  { name: "Toyota Coaster", seats: 20, fuel: "Diesel", price: 35000 },
  { name: "Toyota Fortuner 4x4", seats: 7, fuel: "Diesel", price: 20000 },
];

const packages = [
  {
    name: "Skardu Premium Tour",
    duration: "7 Days 6 Nights",
    price: 95000,
    rating: 4.9,
    reviews: 56,
  },
  {
    name: "Hunza Valley Tour",
    duration: "5 Days 4 Nights",
    price: 65000,
    rating: 4.8,
    reviews: 42,
  },
  {
    name: "Deosai Plains Adventure",
    duration: "3 Days 2 Nights",
    price: 45000,
    rating: 4.7,
    reviews: 38,
  },
];

const reviews = [
  {
    name: "Ahmed Raza",
    rating: 5,
    date: "2 days ago",
    text: "Excellent service! The driver was professional, on-time and very cooperative. The vehicle was clean and comfortable. Highly recommended!",
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    name: "Sara Khan",
    rating: 5,
    date: "1 week ago",
    text: "Smooth booking and a wonderful trip across the valleys. Will definitely use them again.",
    avatar: "https://i.pravatar.cc/150?img=45",
  },
];

const policies = [
  "Free cancellation up to 48 hours before service",
  "Fuel and driver included in all rates",
  "Tolls and parking charged at actuals",
  "Damage to vehicle is the customer's responsibility",
  "Advance booking recommended in peak season",
];

function buildGallery(listing: Listing) {
  const n = parseInt(listing.id.replace(/\D/g, ""), 10) || 1;
  return [
    listing.image,
    `https://loremflickr.com/600/400/jeep,mountains?lock=${n + 60}`,
    `https://loremflickr.com/600/400/road,valley?lock=${n + 61}`,
    `https://loremflickr.com/600/400/lake,turquoise?lock=${n + 62}`,
    `https://loremflickr.com/600/400/car,road,mountains?lock=${n + 63}`,
    `https://loremflickr.com/600/400/landscape,gilgit?lock=${n + 64}`,
  ].map(photo);
}

export function CompanyProfile({ listing }: { listing: Listing }) {
  const variant = listing.category as Variant;
  const isTransport = variant === "transport";
  const company = isTransport ? listing.provider ?? listing.title : listing.title;
  const gallery = React.useMemo(() => buildGallery(listing), [listing]);

  const [activeTab, setActiveTab] = React.useState("overview");
  const [requested, setRequested] = React.useState(false);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "fleet", label: isTransport ? "Our Fleet" : "Packages" },
    { id: "services", label: "Services & Rates" },
    { id: "reviews", label: `Reviews (${listing.reviews})` },
    { id: "gallery", label: "Gallery" },
    { id: "location", label: "Location" },
    { id: "policies", label: "Policies" },
  ];

  const refs = {
    overview: React.useRef<HTMLDivElement>(null),
    fleet: React.useRef<HTMLDivElement>(null),
    services: React.useRef<HTMLDivElement>(null),
    reviews: React.useRef<HTMLDivElement>(null),
    gallery: React.useRef<HTMLDivElement>(null),
    location: React.useRef<HTMLDivElement>(null),
    policies: React.useRef<HTMLDivElement>(null),
  } as const;

  const scrollTo = (id: keyof typeof refs) => {
    setActiveTab(id);
    refs[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stats = isTransport
    ? [
        { icon: Car, value: "25+", label: "Vehicles" },
        { icon: CalendarDays, value: "8+", label: "Years in Business" },
        { icon: Users, value: "18K+", label: "Happy Customers" },
        { icon: ThumbsUp, value: "98%", label: "Positive Reviews" },
        { icon: Headset, value: "24/7", label: "Customer Support" },
      ]
    : [
        { icon: MapIcon, value: "150+", label: "Tours" },
        { icon: CalendarDays, value: "7+", label: "Years" },
        { icon: Users2, value: "3K+", label: "Travelers" },
        { icon: Smile, value: "98%", label: "Happy Clients" },
        { icon: Headset, value: "24/7", label: "Support" },
      ];

  const highlights = isTransport
    ? ["Professional Drivers", "Well Maintained", "On-Time Service", "Clean & Hygienic", "24/7 Support"]
    : ["Expert Guides", "Custom Tours", "Best Value", "Local Experts", "24/7 Support"];

  const trustChips = isTransport
    ? ["Best Price Guarantee", "24/7 Customer Support", "Safe & Reliable", "Clean Vehicles"]
    : ["Best Price Guarantee", "Expert Local Guides", "Tailored Itineraries", "Trusted Operator"];

  const startingPrice = isTransport ? 20000 : 45000;
  const startingUnit = isTransport ? "day" : "person";

  const Icon = isTransport ? Car : MapIcon;

  return (
    <div className="bg-background pb-24 lg:pb-0">
      <div className="container-px pt-6">
        <Link
          href="/listings"
          className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 transition-colors hover:text-gold"
        >
          <ChevronLeft className="h-4 w-4" /> Back to listings
        </Link>
      </div>

      {/* Hero */}
      <section className="relative isolate mt-4 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url('${listing.image}')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-forest-900/92 via-forest-900/70 to-forest-900/40" />
        </div>
        <div className="container-px py-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="hidden h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-forest-600 p-2 text-center text-gold shadow-card sm:flex">
                <Icon className="h-9 w-9" />
                <span className="text-[9px] font-bold uppercase leading-tight text-white">
                  {company}
                </span>
              </span>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified Partner
                </span>
                <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-extrabold text-white sm:text-4xl">
                  {company}
                  <BadgeCheck className="h-6 w-6 text-gold" />
                </h1>
                <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-white">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  {listing.rating.toFixed(1)}
                  <span className="font-normal text-white/75">
                    ({listing.reviews} Reviews)
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-sm text-white/85">
                  <MapPin className="h-4 w-4 text-gold" /> {listing.location},
                  Gilgit Baltistan, Pakistan
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {trustChips.map((c) => (
                    <span
                      key={c}
                      className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="hidden gap-2 sm:flex">
              <button className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-forest hover:bg-white/90">
                <Share2 className="h-4 w-4" /> Share
              </button>
              <button className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-forest hover:bg-white/90">
                <Heart className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="container-px -mt-6 relative z-10">
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-white p-5 shadow-card sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => {
            const SIcon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-600">
                  <SIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-lg font-bold text-forest">
                    {s.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky tabs */}
      <div className="sticky top-16 z-30 mt-6 border-y border-border bg-white/95 backdrop-blur">
        <div className="container-px no-scrollbar flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => scrollTo(t.id as keyof typeof refs)}
              className={cn(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                activeTab === t.id
                  ? "border-gold text-forest"
                  : "border-transparent text-forest/60 hover:text-forest"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container-px mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {/* Overview */}
          <section ref={refs.overview} className="scroll-mt-32">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <h2 className="font-display text-xl font-bold text-forest">
                  About {company}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  We are a trusted {isTransport ? "transport company" : "travel company"} in
                  Gilgit Baltistan offering reliable, comfortable and safe{" "}
                  {isTransport ? "transportation" : "tour"} services for tourists,
                  families, corporate clients and adventure travelers. Our
                  professional team and well-maintained{" "}
                  {isTransport ? "vehicles" : "itineraries"} ensure a memorable
                  journey across the beautiful destinations of GB.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {highlights.map((h) => (
                    <div key={h} className="flex items-center gap-2 text-sm text-forest">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-600">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {h}
                    </div>
                  ))}
                </div>
                <div className="relative mt-5 h-52 overflow-hidden rounded-2xl shadow-premium">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gallery[4]}
                    alt="company video"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 grid place-items-center bg-forest-900/40">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-forest">
                      <Play className="h-6 w-6 fill-forest" />
                    </span>
                  </div>
                  <span className="absolute bottom-3 left-3 text-sm font-semibold text-white">
                    Watch Company Video
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
                <h3 className="font-display text-base font-bold text-forest">
                  Contact Information
                </h3>
                <ul className="mt-3 space-y-2.5 text-sm">
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 text-forest-600" /> +92 300 1234567
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <MessageCircle className="h-4 w-4 text-forest-600" /> +92 300
                    1234567
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 text-forest-600" /> info@rego.com
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />{" "}
                    {listing.location}, Gilgit Baltistan, Pakistan
                  </li>
                </ul>
                <h4 className="mt-4 text-sm font-semibold text-forest">Follow Us</h4>
                <div className="mt-2 flex gap-2">
                  {[Facebook, Instagram, MessageCircle, Youtube].map((S, i) => (
                    <span
                      key={i}
                      className="grid h-9 w-9 place-items-center rounded-full bg-forest-50 text-forest-600"
                    >
                      <S className="h-4 w-4" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Fleet / Packages */}
          <section ref={refs.fleet} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">
              {isTransport ? "Our Fleet" : "Popular Packages"}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {isTransport
                ? fleet.map((v, i) => (
                    <div
                      key={v.name}
                      className="overflow-hidden rounded-2xl border border-border bg-card shadow-premium"
                    >
                      <div className="h-36 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo(
                            `https://loremflickr.com/500/300/suv,car,jeep?lock=${
                              70 + i
                            }`
                          )}
                          alt={v.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="font-display text-base font-semibold text-forest">
                          {v.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> {v.seats} Seats
                          </span>
                          <span>· {v.fuel}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="font-display font-bold text-forest">
                            {formatPrice(v.price)}
                            <span className="text-xs font-normal text-muted-foreground">
                              {" "}
                              /day
                            </span>
                          </p>
                          <Button variant="gold" className="rounded-lg" onClick={() => setRequested(true)}>
                            Book Now
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                : packages.map((p, i) => (
                    <div
                      key={p.name}
                      className="overflow-hidden rounded-2xl border border-border bg-card shadow-premium"
                    >
                      <div className="h-40 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo(
                            `https://loremflickr.com/500/300/mountains,valley,lake?lock=${
                              80 + i
                            }`
                          )}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="font-display text-base font-semibold text-forest">
                          {p.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.duration}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-xs">
                          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                          <span className="font-semibold text-forest">
                            {p.rating}
                          </span>
                          <span className="text-muted-foreground">
                            ({p.reviews})
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="font-display font-bold text-forest">
                            {formatPrice(p.price)}
                            <span className="text-xs font-normal text-muted-foreground">
                              {" "}
                              /person
                            </span>
                          </p>
                          <Button variant="gold" className="rounded-lg" onClick={() => setRequested(true)}>
                            Book Tour
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
            </div>
          </section>

          {/* Services & Rates */}
          <section ref={refs.services} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">
              Services &amp; Rates
            </h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border">
              {(isTransport
                ? [
                    ["Airport transfer (Skardu)", "PKR 5,000"],
                    ["Full-day vehicle with driver", "from PKR 20,000"],
                    ["Multi-day tour transport", "from PKR 18,000 / day"],
                    ["Intercity transfer", "on request"],
                  ]
                : [
                    ["Custom private tour", "from PKR 45,000 / person"],
                    ["Group tour package", "from PKR 35,000 / person"],
                    ["Honeymoon package", "from PKR 120,000 / couple"],
                    ["Corporate / family trips", "on request"],
                  ]
              ).map(([name, price], i) => (
                <div
                  key={name}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 text-sm",
                    i % 2 === 0 ? "bg-white" : "bg-forest-50/40"
                  )}
                >
                  <span className="text-forest">{name}</span>
                  <span className="font-semibold text-forest">{price}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Reviews */}
          <section ref={refs.reviews} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">
              Top Reviews
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {reviews.map((r) => (
                <figure
                  key={r.name}
                  className="rounded-2xl border border-border bg-card p-5 shadow-premium"
                >
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.avatar}
                      alt={r.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-forest">{r.name}</p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: r.rating }).map((_, j) => (
                          <Star key={j} className="h-3.5 w-3.5 fill-gold text-gold" />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{r.date}</span>
                  </div>
                  <blockquote className="mt-3 text-sm leading-relaxed text-forest/85">
                    “{r.text}”
                  </blockquote>
                </figure>
              ))}
            </div>
          </section>

          {/* Gallery */}
          <section ref={refs.gallery} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">Gallery</h2>
            <GalleryGrid images={gallery} title={listing.title} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" itemClassName="h-36 sm:h-44" />
          </section>

          {/* Location */}
          <section ref={refs.location} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">Location</h2>
            <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4 text-forest-600" />
              {company}, {listing.location}, Gilgit Baltistan
            </p>
            <div className="mt-4 h-64 overflow-hidden rounded-2xl shadow-premium">
              <iframe
                title="map"
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  listing.location + ", Gilgit Baltistan"
                )}&output=embed`}
              />
            </div>
          </section>

          {/* Policies */}
          <section ref={refs.policies} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">Policies</h2>
            <ul className="mt-4 space-y-2">
              {policies.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-forest">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
                  {p}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Sticky sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-32 rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="text-xs text-muted-foreground">Starting From</p>
            <p className="font-display text-2xl font-bold text-forest">
              {formatPrice(startingPrice)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                /{startingUnit}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              (Price may vary by {isTransport ? "vehicle" : "package"})
            </p>

            <Button
              variant="gold"
              size="lg"
              className="mt-4 w-full rounded-lg"
              onClick={() => setRequested(true)}
            >
              {requested ? "Request sent ✓" : "Check Availability"}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Response Time: 10 min
            </p>
          </div>
        </aside>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur lg:hidden">
        <div className="container-px flex items-center gap-2 py-3">
          <button
            onClick={() => setRequested(true)}
            className="flex-1 rounded-lg bg-gold py-2.5 text-sm font-bold text-forest-900"
          >
            {requested ? "Sent ✓" : "Check Availability"}
          </button>
        </div>
      </div>
    </div>
  );
}
