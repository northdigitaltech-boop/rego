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
  Camera,
  Video,
  Plane,
  CalendarDays,
  Users,
  Award,
  Phone,
  Mail,
  MessageCircle,
  Instagram,
  Youtube,
  Facebook,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { type Listing } from "@/lib/data";
import { cn, formatPrice, photo } from "@/lib/utils";


const specialties = ["Landscape", "Wedding", "Drone / Aerial", "Portrait", "Travel"];

const stats = [
  { icon: Camera, value: "500+", label: "Shoots Done" },
  { icon: CalendarDays, value: "6+", label: "Years" },
  { icon: Users, value: "1.2K+", label: "Happy Clients" },
  { icon: Award, value: "12", label: "Awards" },
  { icon: Star, value: "4.9", label: "Rating" },
];

const services = [
  { icon: Camera, title: "Photography", desc: "Landscape, portrait & event coverage" },
  { icon: Video, title: "Videography", desc: "Cinematic films & reels" },
  { icon: Plane, title: "Drone / Aerial", desc: "4K aerial shots of GB" },
];

const reviews = [
  {
    name: "Usman Ali",
    rating: 5,
    date: "3 days ago",
    text: "Best travel photos I've ever had. Captured Hunza perfectly — every shot was frame-worthy!",
    avatar: "https://i.pravatar.cc/150?img=33",
  },
  {
    name: "Hira Sheikh",
    rating: 5,
    date: "2 weeks ago",
    text: "Our wedding film was beyond beautiful. Professional, punctual and so creative.",
    avatar: "https://i.pravatar.cc/150?img=47",
  },
];

function buildPortfolio(listing: Listing) {
  const n = parseInt(listing.id.replace(/\D/g, ""), 10) || 1;
  const tags = [
    "mountains,landscape",
    "wedding,couple",
    "lake,reflection",
    "portrait,travel",
    "valley,autumn",
    "drone,aerial,mountains",
    "snow,peak",
    "river,nature",
    "sunset,mountains",
  ];
  return tags.map((t, i) =>
    photo(`https://loremflickr.com/500/500/${t}?lock=${n + 60 + i}`)
  );
}

export function PhotographerProfile({ listing }: { listing: Listing }) {
  const portfolio = React.useMemo(() => buildPortfolio(listing), [listing]);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [booked, setBooked] = React.useState(false);

  const packages = [
    { name: "Half-Day Session", detail: "Up to 4 hours · 40 edited photos", price: 35000 },
    { name: "Full-Day Session", detail: "Up to 8 hours · 90 edited photos", price: 60000 },
    { name: "Wedding Package", detail: "Full event · photos + cinematic film", price: 120000 },
    { name: "Drone + Video Add-on", detail: "4K aerial + highlight reel", price: 25000 },
  ];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "portfolio", label: "Portfolio" },
    { id: "packages", label: "Packages" },
    { id: "reviews", label: `Reviews (${listing.reviews})` },
    { id: "contact", label: "Contact" },
  ];

  const refs = {
    overview: React.useRef<HTMLDivElement>(null),
    portfolio: React.useRef<HTMLDivElement>(null),
    packages: React.useRef<HTMLDivElement>(null),
    reviews: React.useRef<HTMLDivElement>(null),
    contact: React.useRef<HTMLDivElement>(null),
  } as const;

  const scrollTo = (id: keyof typeof refs) => {
    setActiveTab(id);
    refs[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };


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
            style={{ backgroundImage: `url('${portfolio[0]}')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-forest-900/92 via-forest-900/70 to-forest-900/40" />
        </div>
        <div className="container-px py-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="hidden h-24 w-24 shrink-0 place-items-center rounded-2xl bg-forest-600 text-gold shadow-card sm:grid">
                <Camera className="h-10 w-10" />
              </span>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified Partner
                </span>
                <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-extrabold text-white sm:text-4xl">
                  {listing.title}
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
                  Gilgit Baltistan
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
                    >
                      {s}
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
      <div className="container-px relative z-10 -mt-6">
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
            <h2 className="font-display text-xl font-bold text-forest">
              About {listing.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {listing.title} is a professional photographer & videographer based in{" "}
              {listing.location}, specialising in capturing the breathtaking
              landscapes, weddings and travel moments of Gilgit Baltistan. With a
              keen eye for light and detail, every shoot is delivered with fast,
              high-resolution edits.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {services.map((s) => {
                const SIcon = s.icon;
                return (
                  <div
                    key={s.title}
                    className="rounded-2xl border border-border bg-card p-4 shadow-premium"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest-50 text-forest-600">
                      <SIcon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-3 font-display text-sm font-semibold text-forest">
                      {s.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Portfolio */}
          <section ref={refs.portfolio} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">Portfolio</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {portfolio.map((src, i) => (
                <div
                  key={i}
                  className={cn(
                    "overflow-hidden rounded-xl shadow-premium",
                    i % 5 === 0 ? "row-span-2" : ""
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="h-full min-h-[140px] w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Packages */}
          <section ref={refs.packages} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">
              Packages &amp; Rates
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {packages.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-premium"
                >
                  <div>
                    <h3 className="font-display text-base font-semibold text-forest">
                      {p.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.detail}
                    </p>
                    <p className="mt-2 font-display font-bold text-forest">
                      {formatPrice(p.price)}
                    </p>
                  </div>
                  <Button
                    variant="gold"
                    className="rounded-lg"
                    onClick={() => setBooked(true)}
                  >
                    Book
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Reviews */}
          <section ref={refs.reviews} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">
              Client Reviews
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

          {/* Contact */}
          <section ref={refs.contact} className="mt-12 scroll-mt-32">
            <h2 className="font-display text-xl font-bold text-forest">
              Contact &amp; Social
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 text-forest-600" /> +92 300 1234567
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 text-forest-600" /> info@rego.com
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-forest-600" /> {listing.location},
                    GB
                  </li>
                </ul>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
                <p className="text-sm font-semibold text-forest">Follow the work</p>
                <div className="mt-3 flex gap-2">
                  {[Instagram, Facebook, Youtube, MessageCircle].map((S, i) => (
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
        </div>

        {/* Sticky sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-32 rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="text-xs text-muted-foreground">Starting From</p>
            <p className="font-display text-2xl font-bold text-forest">
              {formatPrice(35000)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                /session
              </span>
            </p>

            <div className="mt-4 space-y-3">
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">
                  Shoot date
                </span>
                <input
                  type="date"
                  className="w-full bg-transparent text-sm text-forest focus:outline-none"
                />
              </label>
              <label className="block rounded-lg border border-border px-3 py-2">
                <span className="block text-xs font-semibold text-forest">
                  Package
                </span>
                <select className="w-full bg-transparent text-sm text-forest focus:outline-none">
                  {packages.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <Button
              variant="gold"
              size="lg"
              className="mt-4 w-full rounded-lg"
              onClick={() => setBooked(true)}
            >
              {booked ? "Request sent ✓" : "Book Session"}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Replies within 15 min
            </p>
          </div>
        </aside>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur lg:hidden">
        <div className="container-px flex items-center gap-2 py-3">
          <button
            onClick={() => setBooked(true)}
            className="flex-1 rounded-lg bg-gold py-2.5 text-sm font-bold text-forest-900"
          >
            {booked ? "Sent ✓" : "Book Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
