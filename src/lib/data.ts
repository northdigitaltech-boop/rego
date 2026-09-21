import {
  Building2,
  BedDouble,
  Home,
  Map,
  Bus,
  Briefcase,
  UserRound,
  Camera,
  UtensilsCrossed,
  Mountain,
  FileCheck,
  LayoutGrid,
  Plane,
  Tent,
  Footprints,
  MountainSnow,
  Car,
  Fish,
  Sailboat,
  Landmark,
  Compass,
  Bike,
  BatteryCharging,
  Fuel,
  Truck,
  PartyPopper,
  CalendarDays,
  Store,
  Flag,
  Music,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export type CategorySlug =
  | "hotels"
  | "homestays"
  | "hostels"
  | "mountaineering"
  | "tours"
  | "transport"
  /* Self-drive and private hire, split out of "transport" — see the
     categories array below for why they are not the same service. */
  | "vehicle-rental"
  | "travel-companies"
  | "guides"
  | "photographers"
  | "drone-pilots"
  | "restaurants"
  | "activities"
  | "visa"
  | "more"
  | "roadside"
  | "coworking"
  // Activities
  | "camping"
  | "trekking"
  | "hiking"
  | "jeep-safari"
  | "horse-riding"
  | "fishing"
  | "boating"
  | "cultural-tours"
  // Roadside Assistance
  | "bike-puncture"
  | "car-puncture"
  | "battery-service"
  | "fuel-delivery"
  | "vehicle-recovery"
  // Events & Expo
  | "festivals"
  | "tourism-events"
  | "local-expos"
  | "adventure-events"
  | "cultural-events";

export interface Category {
  slug: CategorySlug;
  name: string;
  icon: LucideIcon;
  tagline: string;
}

export const categories: Category[] = [
  { slug: "hotels", name: "Hotels & Resorts", icon: Building2, tagline: "Comfortable stays with mountain views" },
  { slug: "homestays", name: "Homestays", icon: Home, tagline: "Live with welcoming local families" },
  { slug: "hostels", name: "Hostels", icon: BedDouble, tagline: "Budget beds & cheap local stays" },
  { slug: "mountaineering", name: "Mountaineering & Expeditions", icon: Mountain, tagline: "Expedition companies, guides, porters & crew" },
  { slug: "tours", name: "Tour Packages", icon: Map, tagline: "Curated trips across Gilgit Baltistan" },
  { slug: "transport", name: "Transport", icon: Bus, tagline: "Jeeps, cars and drivers you can trust" },
  /* ------------------------------------------------------------------
     Renting a vehicle is a different purchase from hiring one with a
     driver. The traveller brings a licence instead of a route, cares
     about transmission, deposit and documents rather than an itinerary,
     and pays by the day rather than by the trip. Sharing one category
     meant the two sat behind a tab and were filtered, searched and
     linked to as the same thing.

     This is a BROWSE category only. The provider side is unchanged —
     rental vehicles are still added from the transport provider's own
     dashboard, still belong to a transport_providers row, and there is
     no separate registration to complete.
     ------------------------------------------------------------------ */
  { slug: "vehicle-rental", name: "Vehicle Rental", icon: Car, tagline: "Rent a car, jeep or bike by the hour, day or month" },
  { slug: "travel-companies", name: "Travel Companies", icon: Briefcase, tagline: "Full-service tour operators & DMCs" },
  { slug: "guides", name: "Tour Guides", icon: UserRound, tagline: "Expert local storytellers" },
  { slug: "photographers", name: "Photographers & Videographers", icon: Camera, tagline: "Capture every moment" },
  { slug: "restaurants", name: "Restaurants", icon: UtensilsCrossed, tagline: "Taste authentic local cuisine" },
  { slug: "activities", name: "Activities", icon: Mountain, tagline: "Treks, boating and adventures" },
  { slug: "visa", name: "Visa & Travel Services", icon: FileCheck, tagline: "Permits, visa and travel help" },
  { slug: "more", name: "More Services", icon: LayoutGrid, tagline: "Everything else for your trip" },
];

/* ---- Extended taxonomy (powers the new navigation) ---- */

// Provider services beyond the homepage set.
export const serviceCategories: Category[] = [
  { slug: "drone-pilots", name: "Drone Camera Pilot", icon: Plane, tagline: "Aerial photography & cinematic videography" },
];

export const activityCategories: Category[] = [
  { slug: "camping", name: "Camping", icon: Tent, tagline: "Overnight camps under the stars" },
  { slug: "trekking", name: "Trekking", icon: Footprints, tagline: "Multi-day treks across the Karakoram" },
  { slug: "hiking", name: "Hiking", icon: MountainSnow, tagline: "Day hikes to viewpoints and valleys" },
  { slug: "jeep-safari", name: "Jeep Safari", icon: Car, tagline: "4x4 adventures to remote valleys" },
  { slug: "horse-riding", name: "Horse Riding", icon: Compass, tagline: "Guided rides across alpine meadows" },
  { slug: "fishing", name: "Fishing", icon: Fish, tagline: "Trout fishing in rivers and lakes" },
  { slug: "boating", name: "Boating", icon: Sailboat, tagline: "Boat rides on turquoise lakes" },
  { slug: "cultural-tours", name: "Cultural Tours", icon: Landmark, tagline: "Forts, villages and living heritage" },
];

export const roadsideCategories: Category[] = [
  { slug: "bike-puncture", name: "Bike Puncture Service", icon: Bike, tagline: "On-the-spot motorbike tyre repair" },
  { slug: "car-puncture", name: "Car Puncture Service", icon: Car, tagline: "Roadside car tyre repair" },
  { slug: "battery-service", name: "Battery Service", icon: BatteryCharging, tagline: "Jump-starts and battery help" },
  { slug: "fuel-delivery", name: "Fuel Delivery", icon: Fuel, tagline: "Emergency fuel to your location" },
  { slug: "vehicle-recovery", name: "Vehicle Recovery", icon: Truck, tagline: "Towing and recovery on GB roads" },
];

export const eventCategories: Category[] = [
  { slug: "festivals", name: "Festivals", icon: PartyPopper, tagline: "Seasonal festivals across the region" },
  { slug: "tourism-events", name: "Tourism Events", icon: CalendarDays, tagline: "Official tourism happenings" },
  { slug: "local-expos", name: "Local Expos", icon: Store, tagline: "Craft, food and trade expos" },
  { slug: "adventure-events", name: "Adventure Events", icon: Flag, tagline: "Races, rallies and expeditions" },
  { slug: "cultural-events", name: "Cultural Events", icon: Music, tagline: "Music, dance and heritage nights" },
];

export interface CategoryGroup {
  label: string;
  items: Category[];
}

// Grouped taxonomy used by the listings filter sidebar.
export const categoryGroups: CategoryGroup[] = [
  {
    label: "Services",
    items: [
      ...categories.filter((c) =>
        ["hotels", "homestays", "travel-companies", "tours", "transport", "vehicle-rental", "guides", "photographers"].includes(c.slug)
      ),
      ...serviceCategories,
    ],
  },
  { label: "Activities", items: activityCategories },
  { label: "Roadside Assistance", items: roadsideCategories },
  { label: "Events & Expo", items: eventCategories },
  {
    label: "More",
    items: categories.filter((c) => ["restaurants", "visa", "more"].includes(c.slug)),
  },
];

// Flat list of every category that has a page.
export const allCategories: Category[] = [
  ...categories,
  ...serviceCategories,
  ...activityCategories,
  ...roadsideCategories,
  ...eventCategories,
];

export function getCategory(slug: string) {
  return allCategories.find((c) => c.slug === slug);
}

/* ------------------------------------------------------------------ */
/* Hero search tabs                                                    */
/* ------------------------------------------------------------------ */

export interface SearchTab {
  name: string;
  icon: LucideIcon;
}

export const searchTabs: SearchTab[] = [
  { name: "Stays", icon: Building2 },
  { name: "Tour Packages", icon: Map },
  { name: "Transport", icon: Bus },
  { name: "Tour Guides", icon: UserRound },
  { name: "Homestays", icon: Home },
  { name: "Photographers", icon: Camera },
  { name: "Travel Companies", icon: Briefcase },
];

/* ------------------------------------------------------------------ */
/* Popular destinations                                                */
/* ------------------------------------------------------------------ */

export interface Destination {
  slug: string;
  name: string;
  location: string; // matches Listing.location for filtering
  stays: string;
  tagline: string;
  image: string;
  /** Tourist spots shown on the destination page. Admin-managed. */
  attractions?: import("@/lib/attractions").Attraction[];
}

export const destinations: Destination[] = [
  {
    slug: "skardu",
    name: "Skardu",
    location: "Skardu",
    stays: "120+ Stays",
    tagline: "Gateway to the great Karakoram",
    image: "https://loremflickr.com/1200/700/skardu,lake,mountains?lock=11",
  },
  {
    slug: "hunza",
    name: "Hunza Valley",
    location: "Hunza",
    stays: "98+ Stays",
    tagline: "Land of cherry blossoms and towering peaks",
    image: "https://loremflickr.com/1200/700/hunza,valley,mountains?lock=12",
  },
  {
    slug: "naran",
    name: "Naran Valley",
    location: "Naran",
    stays: "80+ Stays",
    tagline: "Alpine lakes and green meadows",
    image: "https://loremflickr.com/1200/700/valley,river,mountains?lock=13",
  },
  {
    slug: "deosai",
    name: "Deosai Plains",
    location: "Deosai",
    stays: "45+ Stays",
    tagline: "The roof of the world",
    image: "https://loremflickr.com/1200/700/meadow,plains,mountains?lock=14",
  },
  {
    slug: "fairy-meadows",
    name: "Fairy Meadows",
    location: "Fairy Meadows",
    stays: "35+ Stays",
    tagline: "Base camp of mighty Nanga Parbat",
    image: "https://loremflickr.com/1200/700/nanga,parbat,mountain?lock=15",
  },
  {
    slug: "gilgit",
    name: "Gilgit",
    location: "Gilgit",
    stays: "60+ Stays",
    tagline: "The vibrant heart of Gilgit Baltistan",
    image: "https://loremflickr.com/1200/700/gilgit,town,mountains?lock=16",
  },
  {
    slug: "shigar",
    name: "Shigar",
    location: "Shigar",
    stays: "40+ Stays",
    tagline: "Historic forts and cold deserts",
    image: "https://loremflickr.com/1200/700/fort,desert,mountains?lock=17",
  },
  {
    slug: "khaplu",
    name: "Khaplu",
    location: "Khaplu",
    stays: "38+ Stays",
    tagline: "Palaces beside the Shyok river",
    image: "https://loremflickr.com/1200/700/palace,river,mountains?lock=18",
  },
];

export function getDestination(slug: string) {
  return destinations.find((d) => d.slug === slug);
}

export const locations = [
  "Skardu",
  "Hunza",
  "Naran",
  "Gilgit",
  "Shigar",
  "Khaplu",
  "Deosai",
  "Fairy Meadows",
] as const;

/* ------------------------------------------------------------------ */
/* Listings                                                            */
/* ------------------------------------------------------------------ */

/**
 * A short at-a-glance detail on a listing card — duration, group size, seats.
 *
 * The icon is a NAME, not a component: these objects cross the server/client
 * boundary and React can't serialise a function.
 */
export interface ListingFact {
  icon: "clock" | "users" | "calendar" | "car" | "fuel" | "gauge" | "luggage";
  label: string;
}

export interface Listing {
  id: string;
  title: string;
  category: CategorySlug;
  categoryLabel: string;
  location: string;
  price: number;
  unit: string;
  rating: number;
  reviews: number;
  image: string;
  provider?: string;
  featured?: boolean;
  /** Up to 3 comparison details shown under the rating. */
  facts?: ListingFact[];
  /** ISO date the listing was created. Drives the "New" badge; optional
      because not every source populates it yet — absent means no badge,
      never a wrong one. */
  createdAt?: string;
}

// NOTE: Rego shows ONLY real, approved listings from the database.
// This array is intentionally EMPTY — no sample/dummy listings are rendered.
// Real data is loaded via `feedAllListings()` in src/lib/home-feed.ts.
export const listings: Listing[] = [];

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

export interface Testimonial {
  name: string;
  city: string;
  quote: string;
  rating: number;
  avatar: string;
}

// NOTE: Testimonials are REAL customer reviews pulled from the `reviews`
// table (see getFeaturedReviews in src/lib/reviews.ts). This array stays
// empty so no invented quotes are ever shown.
export const testimonials: Testimonial[] = [];
