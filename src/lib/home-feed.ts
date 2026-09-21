import { type Listing } from "@/lib/data";
import { getHotels } from "@/lib/hotels";
import { getHomestays } from "@/lib/homestays";
import { getHostels } from "@/lib/hostels";
import {
  getApprovedPackages,
  getApprovedGuides,
  getApprovedCompanies,
  getApprovedTransports,
  packageToListing,
  guideToListing,
  transportToListing,
  type TourCompanyRow,
} from "@/lib/tour-companies";
import {
  getApprovedServices,
  getApprovedRentals,
  getApprovedProviders,
  serviceToListing,
  rentalToListing,
  type TransportProviderRow,
} from "@/lib/transport";
import { getApprovedMediaProviders, providerToListing } from "@/lib/media";
import { getApprovedRestaurants, restaurantToListing } from "@/lib/restaurants";
import {
  getApprovedRoadsideProviders,
  getAllProviderServices,
  serviceName,
} from "@/lib/roadside";
import { getPublishedEvents, type EventRow } from "@/lib/events";
import { getApprovedActivities, type ActivityRow } from "@/lib/activities";
import {
  /* Aliased: tour-companies already exports getApprovedCompanies above, and
     these are a different kind of company entirely. */
  getApprovedCompanies as getApprovedExpeditionCompanies,
  getApprovedPros as getApprovedExpeditionPros,
  type ExpeditionCompanyRow,
  type ExpeditionProRow,
} from "@/lib/expeditions";
import { getApprovedSolo, type SoloTravelerRow } from "@/lib/solo";
import { getApprovedStories, type StoryRow } from "@/lib/safarnama";
import { photo } from "@/lib/utils";

function companyToListing(c: TourCompanyRow): Listing {
  return {
    id: c.id,
    title: c.name,
    category: "travel-companies",
    categoryLabel: "Travel Company",
    location: c.location || "Gilgit Baltistan",
    price: 0,
    unit: "trip",
    rating: Number(c.rating),
    reviews: c.reviews,
    image: photo(c.cover_image || c.logo || "https://picsum.photos/seed/company/900/600"),
    featured: c.featured,
  };
}

function transportProviderToListing(p: TransportProviderRow): Listing {
  return {
    id: p.id,
    title: p.name,
    category: "transport",
    categoryLabel: p.business_type || "Transport",
    location: p.location || "Gilgit Baltistan",
    price: 0,
    unit: "trip",
    rating: Number(p.rating),
    reviews: p.reviews,
    image: photo(p.cover_image || p.logo || "https://picsum.photos/seed/transport/900/600"),
    featured: p.featured,
  };
}

function topN(items: Listing[], n: number): Listing[] {
  return [...items]
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.rating - a.rating)
    .slice(0, n);
}

export async function feedHotels(n = 4) {
  return topN(await getHotels(), n);
}
export async function feedPackages(n = 4) {
  return topN((await getApprovedPackages()).map(packageToListing), n);
}
export async function feedGuides(n = 4) {
  return topN((await getApprovedGuides()).map(guideToListing), n);
}
export async function feedRestaurants(n = 4) {
  return topN((await getApprovedRestaurants()).map(restaurantToListing), n);
}
export async function feedPhotographers(n = 5) {
  return topN((await getApprovedMediaProviders()).map(providerToListing), n);
}
export async function feedCompanies(n = 5) {
  return topN((await getApprovedCompanies()).map(companyToListing), n);
}
export interface RoadsideCard {
  id: string;
  name: string;
  location: string;
  rating: number;
  reviews: number;
  image: string;
  verified: boolean;
  featured: boolean;
  is247: boolean;
  responseTime: string | null;
  services: string[];
  startingPrice: number;
}

export async function feedRoadside(n = 4): Promise<RoadsideCard[]> {
  const [providers, svc] = await Promise.all([
    getApprovedRoadsideProviders(),
    getAllProviderServices(),
  ]);
  const byProvider = new Map<string, { names: string[]; min: number }>();
  for (const s of svc) {
    if (!s.provider_id) continue;
    const cur = byProvider.get(s.provider_id) ?? { names: [], min: Infinity };
    cur.names.push(serviceName(s.service_type));
    cur.min = Math.min(cur.min, Number(s.starting_price) || 0);
    byProvider.set(s.provider_id, cur);
  }
  return [...providers]
    .sort(
      (a, b) => Number(!!b.featured) - Number(!!a.featured) || Number(b.rating) - Number(a.rating)
    )
    .slice(0, n)
    .map((p) => {
      const agg = byProvider.get(p.id);
      return {
        id: p.id,
        name: p.business_name,
        location: p.city || "Gilgit Baltistan",
        rating: Number(p.rating),
        reviews: p.total_reviews,
        image: photo(p.cover_image || p.profile_image || "https://picsum.photos/seed/roadside/900/600"),
        verified: p.verified,
        featured: p.featured,
        is247: p.is_24_7,
        responseTime: p.response_time,
        services: agg?.names ?? [],
        startingPrice: agg && agg.min !== Infinity ? agg.min : 0,
      };
    });
}

export async function feedEvents(n = 4): Promise<EventRow[]> {
  const events = await getPublishedEvents();
  // Prefer featured + soonest upcoming.
  return [...events]
    .sort(
      (a, b) =>
        Number(!!b.featured) - Number(!!a.featured) ||
        (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999")
    )
    .slice(0, n);
}

export async function feedActivities(n = 4): Promise<ActivityRow[]> {
  const acts = await getApprovedActivities();
  return [...acts]
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || Number(b.rating) - Number(a.rating))
    .slice(0, n);
}

/* ------------------------------------------------------------------
 * Mountaineering & expeditions, for the homepage.
 *
 * Companies and individual professionals are two tables and two detail
 * routes, but on the homepage they are one row of cards — the same way
 * /expeditions shows them under one heading with a filter. So they are
 * normalised here rather than in the component, which then has one shape
 * to render instead of a union it has to keep testing.
 *
 * Every field below is read from the row. Nothing is defaulted into
 * existence: a company with no peaks recorded shows no peaks, and a
 * professional with no rate shows no rate.
 * ------------------------------------------------------------------ */
export interface ExpeditionCard {
  id: string;
  kind: "company" | "pro";
  href: string;
  name: string;
  image: string | null;
  /** City or district, whichever the row actually has. */
  location: string | null;
  /** Peaks for a company, role/title for a professional. Null when unset. */
  detail: string | null;
  yearsExperience: number | null;
  rating: number;
  reviews: number;
  verified: boolean;
  featured: boolean;
  startingPrice: number | null;
}

function expeditionCompanyToCard(c: ExpeditionCompanyRow): ExpeditionCard {
  const peaks = (c.peaks_handled ?? []).filter(Boolean);
  return {
    id: c.id,
    kind: "company",
    href: `/expeditions/company/${c.id}`,
    name: c.name,
    image: c.cover_image || c.logo || null,
    location: c.city || c.district || null,
    detail: peaks.length > 0 ? peaks.slice(0, 3).join(", ") : null,
    yearsExperience: c.years_experience,
    rating: Number(c.rating) || 0,
    reviews: Number(c.reviews) || 0,
    verified: !!c.verified,
    featured: !!c.featured,
    startingPrice: c.starting_price,
  };
}

function expeditionProToCard(p: ExpeditionProRow): ExpeditionCard {
  return {
    id: p.id,
    kind: "pro",
    href: `/expeditions/pro/${p.id}`,
    name: p.full_name,
    image: p.photo || p.cover_image || null,
    location: p.city || p.district || null,
    detail: p.title || p.role || null,
    yearsExperience: p.years_experience,
    rating: Number(p.rating) || 0,
    reviews: Number(p.reviews) || 0,
    verified: !!p.verified,
    featured: !!p.featured,
    startingPrice: p.daily_rate ?? p.package_rate ?? null,
  };
}

export async function feedExpeditions(n = 4): Promise<ExpeditionCard[]> {
  const [companies, pros] = await Promise.all([
    getApprovedExpeditionCompanies(),
    getApprovedExpeditionPros(),
  ]);

  return [
    ...companies.map(expeditionCompanyToCard),
    ...pros.map(expeditionProToCard),
  ]
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        Number(b.verified) - Number(a.verified) ||
        b.rating - a.rating
    )
    .slice(0, n);
}

export async function feedSolo(n = 4): Promise<SoloTravelerRow[]> {
  const travelers = await getApprovedSolo();
  return [...travelers]
    .sort(
      (a, b) =>
        Number(!!b.featured) - Number(!!a.featured) ||
        (b.last_active ?? "").localeCompare(a.last_active ?? "")
    )
    .slice(0, n);
}

export async function feedStories(n = 3): Promise<StoryRow[]> {
  const stories = await getApprovedStories();
  return [...stories]
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.views - a.views)
    .slice(0, n);
}

/* Driven-for-you only. Rentals used to be mixed in here, which made the
   homepage row show vehicles that its own "View All Transport" link then
   did not list — the two disagreed the moment rentals became their own
   category. feedRentals() below is where they go instead. */
export async function feedTransport(n = 5) {
  const [services, transports] = await Promise.all([
    getApprovedServices(),
    getApprovedTransports(),
  ]);
  const priced = [
    ...services.map(serviceToListing),
    ...transports.map(transportToListing),
  ];
  if (priced.length > 0) return topN(priced, n);
  return topN((await getApprovedProviders()).map(transportProviderToListing), n);
}

/** Self-drive and private hire, for the Vehicle Rental row. */
export async function feedRentals(n = 5) {
  return topN((await getApprovedRentals()).map(rentalToListing), n);
}

/**
 * Every REAL (approved) listing across all services, as a flat Listing[].
 * Used by the /listings browser and site search — there is no sample data,
 * so an empty result simply means nothing has been approved yet.
 */
export async function feedAllListings(): Promise<Listing[]> {
  const [
    hotels,
    homestays,
    hostels,
    packages,
    guides,
    restaurants,
    photographers,
    companies,
    services,
    rentals,
    transports,
  ] = await Promise.all([
    getHotels(),
    /* Homestays and hostels were missing from this feed, which is what every
       page built on it shows. On a destination page that meant tapping
       "Homestays" always came back empty — not because there were none, but
       because they were never fetched. Both getters already return Listing[],
       so there was nothing to map. */
    getHomestays(),
    getHostels(),
    getApprovedPackages(),
    getApprovedGuides(),
    getApprovedRestaurants(),
    getApprovedMediaProviders(),
    getApprovedCompanies(),
    getApprovedServices(),
    getApprovedRentals(),
    getApprovedTransports(),
  ]);

  const all: Listing[] = [
    ...hotels,
    ...homestays,
    ...hostels,
    ...packages.map(packageToListing),
    ...guides.map(guideToListing),
    ...restaurants.map(restaurantToListing),
    ...photographers.map(providerToListing),
    ...companies.map(companyToListing),
    ...services.map(serviceToListing),
    ...rentals.map(rentalToListing),
    ...transports.map(transportToListing),
  ];

  // De-duplicate defensively, then put featured + best-rated first.
  const seen = new Set<string>();
  return all
    .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)))
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.rating - a.rating);
}
