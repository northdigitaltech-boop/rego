import { type Listing } from "@/lib/data";
import { getHotels } from "@/lib/hotels";
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

export async function feedTransport(n = 5) {
  const [services, rentals, transports] = await Promise.all([
    getApprovedServices(),
    getApprovedRentals(),
    getApprovedTransports(),
  ]);
  const priced = [
    ...services.map(serviceToListing),
    ...rentals.map(rentalToListing),
    ...transports.map(transportToListing),
  ];
  if (priced.length > 0) return topN(priced, n);
  return topN((await getApprovedProviders()).map(transportProviderToListing), n);
}
