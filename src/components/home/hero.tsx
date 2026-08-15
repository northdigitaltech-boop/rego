"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Search,
  MapPin,
  Calendar,
  UserRound,
  CheckCircle2,
  MoreHorizontal,
  RotateCcw,
  PlaneTakeoff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteSearch } from "@/components/ui/site-search";
import { HeroWeather } from "@/components/home/hero-weather";
import { searchTabs, type CategorySlug } from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  getSavedFilters,
  saveFilters,
  clearSavedFilters,
  addRecentSearch,
} from "@/lib/search-memory";

const trustBadges = [
  "Best Price Guarantee",
  "Trusted Local Partners",
  "24/7 Support",
];

// Maps each hero search tab to the category it should filter by.
const tabToCategory: Record<string, CategorySlug> = {
  Stays: "hotels",
  "Tour Packages": "tours",
  Transport: "transport",
  "Tour Guides": "guides",
  Homestays: "homestays",
  Photographers: "photographers",
  "Travel Companies": "travel-companies",
  "Drone Camera Pilot": "drone-pilots",
  Restaurants: "restaurants",
  Activities: "activities",
  "Visa & Travel Services": "visa",
};

/** How many service tabs appear before the Flights shortcut. */
const FLIGHTS_AFTER = 4;

// Extra services revealed by the "More" button (not shown as primary tabs).
const moreServices: { name: string; slug: CategorySlug }[] = [
  { name: "Drone Camera Pilot", slug: "drone-pilots" },
  { name: "Restaurants", slug: "restaurants" },
  { name: "Activities", slug: "activities" },
  { name: "Visa & Travel Services", slug: "visa" },
];

// Each tab shows only the fields relevant to that service.
type Dates = "range" | "single" | "none";
interface TabConfig {
  destLabel: string;
  destPlaceholder: string;
  dates: Dates;
  dateLabel: string;
  peopleLabel: string | null;
}
const tabConfig: Record<string, TabConfig> = {
  Stays: {
    destLabel: "Where are you going?",
    destPlaceholder: "Destination or hotel name",
    dates: "range",
    dateLabel: "Check-in",
    peopleLabel: "Guests",
  },
  Homestays: {
    destLabel: "Where are you going?",
    destPlaceholder: "Destination or homestay",
    dates: "range",
    dateLabel: "Check-in",
    peopleLabel: "Guests",
  },
  "Tour Packages": {
    destLabel: "Destination",
    destPlaceholder: "Where do you want to explore?",
    dates: "single",
    dateLabel: "Tour date",
    peopleLabel: "Persons",
  },
  Transport: {
    destLabel: "Pickup location",
    destPlaceholder: "City or area",
    dates: "single",
    dateLabel: "Pickup date",
    peopleLabel: "Passengers",
  },
  "Tour Guides": {
    destLabel: "Area",
    destPlaceholder: "Where do you need a guide?",
    dates: "single",
    dateLabel: "Date",
    peopleLabel: "Persons",
  },
  Photographers: {
    destLabel: "Shoot location",
    destPlaceholder: "City or venue",
    dates: "single",
    dateLabel: "Shoot date",
    peopleLabel: "People",
  },
};
// Generic fields for "More" services that aren't one of the primary tabs.
const GENERIC_CFG: TabConfig = {
  destLabel: "Where?",
  destPlaceholder: "City, area or name",
  dates: "single",
  dateLabel: "Date",
  peopleLabel: "People",
};

export function Hero() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [activeTab, setActiveTab] = React.useState(searchTabs[0].name);
  const [destination, setDestination] = React.useState("");
  const [pickedHref, setPickedHref] = React.useState("");
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [guests, setGuests] = React.useState(1);

  const [moreOpen, setMoreOpen] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<
    null | { field: "dates"; message: string }
  >(null);
  const cfg = tabConfig[activeTab] ?? GENERIC_CFG;

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  /* Bring back what they searched last time — but only if it's still
     sensible (see getSavedFilters: past dates are dropped). */
  React.useEffect(() => {
    const saved = getSavedFilters();
    if (!saved) return;
    if (saved.service && (tabConfig[saved.service] || moreServices.some((m) => m.name === saved.service))) {
      setActiveTab(saved.service);
    }
    if (saved.destination) setDestination(saved.destination);
    if (saved.checkIn) setCheckIn(saved.checkIn);
    if (saved.checkOut) setCheckOut(saved.checkOut);
    if (saved.guests && saved.guests > 1) setGuests(saved.guests);
  }, []);

  const hasInput =
    destination.trim() !== "" || checkIn !== "" || checkOut !== "" || guests > 1;

  const resetSearch = () => {
    setDestination("");
    setPickedHref("");
    setCheckIn("");
    setCheckOut("");
    setGuests(1);
    setFieldError(null);
    clearSavedFilters();
  };

  const dateParams = () => {
    const p = new URLSearchParams();
    if (checkIn) p.set("checkin", checkIn);
    if (cfg.dates === "range" && checkOut) p.set("checkout", checkOut);
    if (cfg.peopleLabel && guests > 1) p.set("guests", String(guests));
    return p;
  };

  // Typing clears any previously picked target.
  const handleDestChange = (v: string) => {
    setDestination(v);
    setPickedHref("");
  };

  // Only runs when the Search button is clicked.
  const handleSearch = () => {
    // Validate beside the field rather than in a banner at the top.
    setFieldError(null);
    if (cfg.dates === "range" && checkIn && checkOut && checkOut <= checkIn) {
      setFieldError({
        field: "dates",
        message: "Check-out must be after check-in.",
      });
      return;
    }

    saveFilters({
      service: activeTab,
      destination: destination.trim() || undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      guests,
    });
    if (destination.trim()) {
      addRecentSearch({ label: destination.trim(), service: activeTab });
    }

    const p = dateParams();
    const qs = p.toString();
    // Picked a specific suggestion → go straight to it.
    if (pickedHref) {
      router.push(
        qs ? `${pickedHref}${pickedHref.includes("?") ? "&" : "?"}${qs}` : pickedHref
      );
      return;
    }
    if (destination.trim()) p.set("location", destination.trim());
    const cat = tabToCategory[activeTab];
    // Send the search to the selected service's live category page, filtered by
    // the destination — so only that service at that place is shown.
    if (cat) {
      const all = p.toString();
      router.push(all ? `/categories/${cat}?${all}` : `/categories/${cat}`);
      return;
    }
    const all = p.toString();
    router.push(all ? `/listings?${all}` : "/listings");
  };

  return (
    <section className="relative isolate overflow-hidden">
      {/* Background — static & light on mobile; slow Ken Burns motion on
          desktop via cheap CSS (no JS animation on the critical path). */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="hero-kenburns relative h-full w-full">
          {/* LCP element. Deliberately a plain <img> with PRE-BUILT WebP files
              instead of next/image: `/_next/image` transforms on demand, and
              that per-region cold-start was costing seconds on the first view.
              These are static assets served straight from the CDN. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-1024.webp"
            srcSet="/hero-640.webp 640w, /hero-1024.webp 1024w, /hero-1536.webp 1536w"
            sizes="100vw"
            alt=""
            width={1536}
            height={1024}
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </div>
        {/* Soft wash on the left only — keeps the headline readable while the
            photo stays clean and bright. */}
        <div className="absolute inset-0 bg-gradient-to-r from-forest-900/55 via-forest-900/15 to-transparent" />
      </div>

      <div className="container-px relative pb-12 pt-16 lg:pb-36 lg:pt-20">
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.7, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <p className="font-script text-3xl text-gold sm:text-4xl">
            Explore The Beauty of
          </p>
          <h1 className="mt-1 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            <span className="text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
              GILGIT BALTISTAN
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-white/85 sm:text-lg">
            Book hotels, tours, transport, guides, homestays and more – all in one
            place.
          </p>

          <div className="mt-6 flex flex-wrap gap-x-7 gap-y-3">
            {trustBadges.map((badge) => (
              <span
                key={badge}
                className="flex items-center gap-2 text-sm font-medium text-white"
              >
                <CheckCircle2 className="h-5 w-5 text-gold" />
                {badge}
              </span>
            ))}
          </div>

          {/* Live weather for key GB destinations */}
          <HeroWeather />
        </motion.div>
      </div>

      {/* Search card — overlaps the hero on large screens, sits below it on mobile */}
      <div className="container-px relative mt-2 pb-12 lg:-mt-24 lg:pb-16">
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : 0.15, ease: "easeOut" }}
          className="rounded-3xl border border-white/60 bg-white/95 p-4 shadow-premium-lg backdrop-blur-xl sm:p-5"
        >
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pb-3">
            {/* Stays leads — it's what most people come for. Flights sits
                after the fourth service because it leaves Rego for its own
                search page, so it shouldn't be the first thing on offer. */}
            {searchTabs.map((tab, i) => {
              const Icon = tab.icon;
              const active = tab.name === activeTab;
              return (
                <React.Fragment key={tab.name}>
                  <button
                    onClick={() => setActiveTab(tab.name)}
                    aria-pressed={active}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
                      active
                        ? "bg-gradient-forest text-white shadow-soft"
                        : "text-forest/70 hover:bg-forest/5"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.name}
                  </button>

                  {i === FLIGHTS_AFTER - 1 && (
                    <button
                      onClick={() => router.push("/flights")}
                      className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-forest/70 transition-colors hover:bg-forest/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                    >
                      <PlaneTakeoff className="h-4 w-4" />
                      Flights
                    </button>
                  )}
                </React.Fragment>
              );
            })}
            {/* More — opens a dropdown overlay (doesn't push the layout) */}
            <div className="relative shrink-0">
              <button
                onClick={() => setMoreOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
                  moreServices.some((m) => m.name === activeTab)
                    ? "bg-gradient-forest text-white shadow-soft"
                    : "text-forest/70 hover:bg-forest/5"
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
                {moreServices.some((m) => m.name === activeTab) ? activeTab : "More"}
              </button>
              {moreOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMoreOpen(false)}
                  />
                  <motion.div
                    role="menu"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: reduce ? 0 : 0.16, ease: "easeOut" }}
                    className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-xl border border-border bg-white p-1.5 shadow-premium-lg"
                  >
                    {moreServices.map((m) => (
                      <button
                        key={m.slug}
                        role="menuitem"
                        onClick={() => {
                          setActiveTab(m.name);
                          setMoreOpen(false);
                        }}
                        className={cn(
                          "block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
                          m.name === activeTab
                            ? "bg-forest-50 text-forest-600"
                            : "text-forest hover:bg-muted"
                        )}
                      >
                        {m.name}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </div>
          </div>

          {/* Fields — adapt to the selected service */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/30 p-2 lg:flex-row lg:items-stretch">
            {/* Destination */}
            <label className="group flex min-w-0 flex-[2] items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted focus-within:bg-muted focus-within:ring-2 focus-within:ring-forest-600/40">
              <MapPin className="h-5 w-5 shrink-0 text-forest-600" />
              <span className="flex w-full flex-col">
                <span className="text-xs font-semibold text-forest">{cfg.destLabel}</span>
                <SiteSearch
                  service={activeTab}
                  value={destination}
                  onChange={handleDestChange}
                  onPick={setPickedHref}
                  placeholder={cfg.destPlaceholder}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </span>
            </label>

            {/* Date(s) */}
            {cfg.dates !== "none" && (
              <label className="flex flex-1 items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted focus-within:bg-muted focus-within:ring-2 focus-within:ring-forest-600/40">
                <Calendar className="h-5 w-5 shrink-0 text-forest-600" />
                <span className="flex w-full flex-col">
                  <span className="text-xs font-semibold text-forest">{cfg.dateLabel}</span>
                  <input
                    type="date"
                    value={checkIn}
                    min={today}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      setFieldError(null);
                      // Keep the range coherent as they type.
                      if (checkOut && e.target.value && checkOut <= e.target.value) {
                        setCheckOut("");
                      }
                    }}
                    className="w-full bg-transparent text-sm text-foreground focus:outline-none"
                  />
                </span>
              </label>
            )}
            {cfg.dates === "range" && (
              <label
                className={cn(
                  "flex flex-1 items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted focus-within:bg-muted focus-within:ring-2 focus-within:ring-forest-600/40",
                  fieldError?.field === "dates" && "ring-2 ring-red-400"
                )}
              >
                <Calendar className="h-5 w-5 shrink-0 text-forest-600" />
                <span className="flex w-full flex-col">
                  <span className="text-xs font-semibold text-forest">Check-out</span>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn || today}
                    onChange={(e) => {
                      setCheckOut(e.target.value);
                      setFieldError(null);
                    }}
                    aria-invalid={fieldError?.field === "dates"}
                    className="w-full bg-transparent text-sm text-foreground focus:outline-none"
                  />
                  {/* Validation sits beside the field it belongs to. */}
                  {fieldError?.field === "dates" && (
                    <span role="alert" className="mt-0.5 text-[11px] font-semibold text-red-600">
                      {fieldError.message}
                    </span>
                  )}
                </span>
              </label>
            )}

            {/* People */}
            {cfg.peopleLabel && (
              <label className="flex flex-1 items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted focus-within:bg-muted focus-within:ring-2 focus-within:ring-forest-600/40">
                <UserRound className="h-5 w-5 shrink-0 text-forest-600" />
                <span className="flex w-full flex-col">
                  <span className="text-xs font-semibold text-forest">{cfg.peopleLabel}</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    inputMode="numeric"
                    value={guests || ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setGuests(Number.isNaN(v) ? 0 : Math.min(99, Math.max(0, v)));
                    }}
                    onBlur={() => setGuests((g) => (g < 1 ? 1 : g))}
                    placeholder={`Enter ${(cfg.peopleLabel ?? "guests").toLowerCase()}`}
                    className="w-full bg-transparent text-sm text-foreground focus:outline-none"
                  />
                </span>
              </label>
            )}

            <Button
              onClick={handleSearch}
              variant="gold"
              size="lg"
              className="h-auto min-h-[56px] shrink-0 gap-2 rounded-xl bg-gradient-forest px-7 text-white"
            >
              <Search className="h-5 w-5" />
              Search
            </Button>
          </div>

          {/* Reset — only offered once there's something to clear. */}
          {hasInput && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={resetSearch}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-forest"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Clear search
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
