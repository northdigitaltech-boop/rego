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
        ["hotels", "homestays", "travel-companies", "tours", "transport", "guides", "photographers"].includes(c.slug)
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
}

export const listings: Listing[] = [
  {
    id: "l1",
    title: "Shangrila Resort Skardu",
    category: "hotels",
    categoryLabel: "Hotel",
    location: "Skardu",
    price: 25000,
    unit: "night",
    rating: 4.8,
    reviews: 128,
    image: "https://loremflickr.com/900/600/resort,hotel,mountain?lock=21",
    featured: true,
  },
  {
    id: "l2",
    title: "Hunza View Homestay",
    category: "homestays",
    categoryLabel: "Homestay",
    location: "Hunza",
    price: 8000,
    unit: "night",
    rating: 4.9,
    reviews: 86,
    image: "https://loremflickr.com/900/600/guesthouse,cottage,mountain?lock=22",
    featured: true,
  },
  {
    id: "l3",
    title: "Toyota Land Cruiser VX",
    category: "transport",
    categoryLabel: "Transport",
    location: "Skardu",
    price: 18000,
    unit: "day",
    rating: 4.9,
    reviews: 64,
    image: "https://loremflickr.com/900/600/landcruiser,suv,car?lock=23",
    provider: "Baltistan Rent a Car",
    featured: true,
  },
  {
    id: "l4",
    title: "Mountain Clicks",
    category: "photographers",
    categoryLabel: "Photographer",
    location: "Skardu",
    price: 35000,
    unit: "session",
    rating: 5.0,
    reviews: 42,
    image: "https://loremflickr.com/900/600/photographer,camera,mountain?lock=24",
    featured: true,
  },
  {
    id: "l5",
    title: "Deosai Jeep Tour",
    category: "activities",
    categoryLabel: "Activity",
    location: "Deosai",
    price: 12000,
    unit: "person",
    rating: 4.7,
    reviews: 71,
    image: "https://loremflickr.com/900/600/jeep,offroad,mountain?lock=25",
    featured: true,
  },
  {
    id: "l6",
    title: "Serena Hunza Hotel",
    category: "hotels",
    categoryLabel: "Hotel",
    location: "Hunza",
    price: 30000,
    unit: "night",
    rating: 4.9,
    reviews: 203,
    image: "https://loremflickr.com/900/600/luxury,hotel,resort?lock=26",
  },
  {
    id: "l7",
    title: "Eagle's Nest Homestay",
    category: "homestays",
    categoryLabel: "Homestay",
    location: "Hunza",
    price: 6500,
    unit: "night",
    rating: 4.7,
    reviews: 54,
    image: "https://loremflickr.com/900/600/cabin,cottage,mountain?lock=27",
  },
  {
    id: "l8",
    title: "Fairy Meadows Trek Package",
    category: "tours",
    categoryLabel: "Tour Package",
    location: "Fairy Meadows",
    price: 45000,
    unit: "package",
    rating: 4.8,
    reviews: 97,
    image: "https://loremflickr.com/900/600/trekking,hiking,mountain?lock=28",
    featured: true,
  },
  {
    id: "l9",
    title: "Karakoram Guided Expedition",
    category: "tours",
    categoryLabel: "Tour Package",
    location: "Skardu",
    price: 60000,
    unit: "package",
    rating: 4.9,
    reviews: 61,
    image: "https://loremflickr.com/900/600/karakoram,mountain,snow?lock=29",
  },
  {
    id: "l10",
    title: "Hunza Local Guide — Karim",
    category: "guides",
    categoryLabel: "Tour Guide",
    location: "Hunza",
    price: 5000,
    unit: "day",
    rating: 5.0,
    reviews: 88,
    image: "https://loremflickr.com/900/600/hiking,guide,mountain?lock=30",
  },
  {
    id: "l11",
    title: "Prado 4x4 with Driver",
    category: "transport",
    categoryLabel: "Transport",
    location: "Gilgit",
    price: 16000,
    unit: "day",
    rating: 4.6,
    reviews: 39,
    image: "https://loremflickr.com/900/600/jeep,4x4,road?lock=31",
    provider: "Karakoram Movers",
  },
  {
    id: "l12",
    title: "Attabad Lake Boating",
    category: "activities",
    categoryLabel: "Activity",
    location: "Hunza",
    price: 4000,
    unit: "person",
    rating: 4.5,
    reviews: 112,
    image: "https://loremflickr.com/900/600/lake,boat,turquoise?lock=32",
  },
  {
    id: "l13",
    title: "Naran Valley Resort",
    category: "hotels",
    categoryLabel: "Hotel",
    location: "Naran",
    price: 14000,
    unit: "night",
    rating: 4.4,
    reviews: 76,
    image: "https://loremflickr.com/900/600/resort,valley,mountain?lock=33",
  },
  {
    id: "l14",
    title: "Skardu Wedding & Travel Films",
    category: "photographers",
    categoryLabel: "Videographer",
    location: "Skardu",
    price: 50000,
    unit: "session",
    rating: 4.8,
    reviews: 33,
    image: "https://loremflickr.com/900/600/videographer,camera,film?lock=34",
  },
  {
    id: "l15",
    title: "Pakistan Visa Assistance",
    category: "visa",
    categoryLabel: "Visa Service",
    location: "Gilgit",
    price: 9000,
    unit: "application",
    rating: 4.6,
    reviews: 47,
    image: "https://loremflickr.com/900/600/passport,travel,documents?lock=35",
  },
  {
    id: "l16",
    title: "Karakoram Travels & Tours",
    category: "travel-companies",
    categoryLabel: "Travel Company",
    location: "Gilgit",
    price: 40000,
    unit: "package",
    rating: 4.8,
    reviews: 156,
    image: "https://loremflickr.com/900/600/travel,agency,mountains?lock=36",
    featured: true,
  },
  {
    id: "l17",
    title: "Roof of the World DMC",
    category: "travel-companies",
    categoryLabel: "Travel Company",
    location: "Skardu",
    price: 55000,
    unit: "package",
    rating: 4.7,
    reviews: 92,
    image: "https://loremflickr.com/900/600/adventure,travel,mountains?lock=37",
  },
  {
    id: "l18",
    title: "Café de Hunza",
    category: "restaurants",
    categoryLabel: "Restaurant",
    location: "Hunza",
    price: 1500,
    unit: "person",
    rating: 4.7,
    reviews: 240,
    image: "https://loremflickr.com/900/600/cafe,coffee,restaurant?lock=38",
    featured: true,
  },
  {
    id: "l19",
    title: "Dewane Khaas Restaurant",
    category: "restaurants",
    categoryLabel: "Restaurant",
    location: "Skardu",
    price: 2000,
    unit: "person",
    rating: 4.6,
    reviews: 134,
    image: "https://loremflickr.com/900/600/restaurant,dinner,traditional?lock=39",
  },
  {
    id: "l20",
    title: "Shinwari Tikka House",
    category: "restaurants",
    categoryLabel: "Restaurant",
    location: "Gilgit",
    price: 1800,
    unit: "person",
    rating: 4.5,
    reviews: 188,
    image: "https://loremflickr.com/900/600/bbq,grill,food?lock=40",
  },
  {
    id: "l21",
    title: "Shigar Fort Residence",
    category: "hotels",
    categoryLabel: "Heritage Hotel",
    location: "Shigar",
    price: 28000,
    unit: "night",
    rating: 4.9,
    reviews: 110,
    image: "https://loremflickr.com/900/600/fort,heritage,hotel?lock=41",
    featured: true,
  },
  {
    id: "l22",
    title: "Khaplu Palace Hotel",
    category: "hotels",
    categoryLabel: "Heritage Hotel",
    location: "Khaplu",
    price: 26000,
    unit: "night",
    rating: 4.8,
    reviews: 95,
    image: "https://loremflickr.com/900/600/palace,heritage,mountains?lock=42",
  },
  {
    id: "l23",
    title: "Deosai Camping Experience",
    category: "activities",
    categoryLabel: "Activity",
    location: "Deosai",
    price: 9000,
    unit: "person",
    rating: 4.7,
    reviews: 58,
    image: "https://loremflickr.com/900/600/camping,tent,plains?lock=43",
  },
  {
    id: "l24",
    title: "Khaplu Valley Homestay",
    category: "homestays",
    categoryLabel: "Homestay",
    location: "Khaplu",
    price: 7000,
    unit: "night",
    rating: 4.6,
    reviews: 41,
    image: "https://loremflickr.com/900/600/village,house,mountains?lock=44",
  },
  {
    id: "l25",
    title: "Shigar Cultural Day Tour",
    category: "tours",
    categoryLabel: "Tour Package",
    location: "Shigar",
    price: 15000,
    unit: "person",
    rating: 4.7,
    reviews: 37,
    image: "https://loremflickr.com/900/600/culture,fort,tour?lock=45",
  },

  /* ---- Drone Pilots ---- */
  { id: "dp1", title: "Skyview Aerials Skardu", category: "drone-pilots", categoryLabel: "Drone Pilot", location: "Skardu", price: 30000, unit: "session", rating: 4.9, reviews: 36, image: "https://loremflickr.com/900/600/drone,aerial,mountain?lock=60" },
  { id: "dp2", title: "Karakoram Drone Films", category: "drone-pilots", categoryLabel: "Drone Pilot", location: "Hunza", price: 38000, unit: "session", rating: 4.8, reviews: 29, image: "https://loremflickr.com/900/600/drone,filming,valley?lock=61" },
  { id: "dp3", title: "Highland Aerial Studio", category: "drone-pilots", categoryLabel: "Drone Pilot", location: "Gilgit", price: 25000, unit: "session", rating: 4.7, reviews: 22, image: "https://loremflickr.com/900/600/aerial,drone,landscape?lock=62" },

  /* ---- Camping ---- */
  { id: "cmp1", title: "Deosai Night Camp", category: "camping", categoryLabel: "Camping", location: "Deosai", price: 9000, unit: "person", rating: 4.7, reviews: 64, image: "https://loremflickr.com/900/600/camping,tent,plains?lock=63" },
  { id: "cmp2", title: "Fairy Meadows Star Camp", category: "camping", categoryLabel: "Camping", location: "Fairy Meadows", price: 8000, unit: "person", rating: 4.8, reviews: 51, image: "https://loremflickr.com/900/600/camp,tent,mountain?lock=64" },
  { id: "cmp3", title: "Upper Kachura Lakeside Camp", category: "camping", categoryLabel: "Camping", location: "Skardu", price: 8500, unit: "person", rating: 4.6, reviews: 38, image: "https://loremflickr.com/900/600/camping,lake,night?lock=65" },

  /* ---- Trekking ---- */
  { id: "trk1", title: "K2 Base Camp Trek", category: "trekking", categoryLabel: "Trek", location: "Skardu", price: 55000, unit: "package", rating: 4.9, reviews: 47, image: "https://loremflickr.com/900/600/trekking,k2,glacier?lock=66" },
  { id: "trk2", title: "Nanga Parbat Base Camp Trek", category: "trekking", categoryLabel: "Trek", location: "Fairy Meadows", price: 40000, unit: "package", rating: 4.8, reviews: 39, image: "https://loremflickr.com/900/600/trekking,trail,mountain?lock=67" },
  { id: "trk3", title: "Rakaposhi Base Camp Trek", category: "trekking", categoryLabel: "Trek", location: "Hunza", price: 35000, unit: "package", rating: 4.7, reviews: 33, image: "https://loremflickr.com/900/600/hiking,glacier,peak?lock=68" },

  /* ---- Hiking ---- */
  { id: "hik1", title: "Ofush Valley Day Hike", category: "hiking", categoryLabel: "Hike", location: "Hunza", price: 6000, unit: "person", rating: 4.6, reviews: 28, image: "https://loremflickr.com/900/600/hiking,valley,trail?lock=69" },
  { id: "hik2", title: "Manthokha Waterfall Hike", category: "hiking", categoryLabel: "Hike", location: "Khaplu", price: 5000, unit: "person", rating: 4.5, reviews: 24, image: "https://loremflickr.com/900/600/waterfall,hike,forest?lock=70" },
  { id: "hik3", title: "Eagle's Nest Sunrise Hike", category: "hiking", categoryLabel: "Hike", location: "Hunza", price: 4500, unit: "person", rating: 4.8, reviews: 41, image: "https://loremflickr.com/900/600/sunrise,hike,mountain?lock=71" },

  /* ---- Jeep Safari ---- */
  { id: "js1", title: "Deosai Plains Jeep Safari", category: "jeep-safari", categoryLabel: "Jeep Safari", location: "Deosai", price: 14000, unit: "jeep", rating: 4.7, reviews: 58, image: "https://loremflickr.com/900/600/jeep,offroad,plains?lock=72" },
  { id: "js2", title: "Khaplu Valley 4x4 Safari", category: "jeep-safari", categoryLabel: "Jeep Safari", location: "Khaplu", price: 16000, unit: "jeep", rating: 4.6, reviews: 31, image: "https://loremflickr.com/900/600/jeep,4x4,valley?lock=73" },
  { id: "js3", title: "Shimshal Jeep Adventure", category: "jeep-safari", categoryLabel: "Jeep Safari", location: "Hunza", price: 22000, unit: "jeep", rating: 4.8, reviews: 26, image: "https://loremflickr.com/900/600/jeep,mountain,road?lock=74" },

  /* ---- Horse Riding ---- */
  { id: "hr1", title: "Deosai Horseback Trail", category: "horse-riding", categoryLabel: "Horse Riding", location: "Deosai", price: 6000, unit: "person", rating: 4.6, reviews: 22, image: "https://loremflickr.com/900/600/horse,meadow,mountain?lock=75" },
  { id: "hr2", title: "Shigar Meadow Pony Ride", category: "horse-riding", categoryLabel: "Horse Riding", location: "Shigar", price: 3500, unit: "person", rating: 4.5, reviews: 18, image: "https://loremflickr.com/900/600/horse,riding,field?lock=76" },
  { id: "hr3", title: "Naran Valley Horse Riding", category: "horse-riding", categoryLabel: "Horse Riding", location: "Naran", price: 4000, unit: "person", rating: 4.7, reviews: 27, image: "https://loremflickr.com/900/600/horse,valley,green?lock=77" },

  /* ---- Fishing ---- */
  { id: "fsh1", title: "Kachura Lake Trout Fishing", category: "fishing", categoryLabel: "Fishing", location: "Skardu", price: 5000, unit: "person", rating: 4.6, reviews: 30, image: "https://loremflickr.com/900/600/fishing,lake,trout?lock=78" },
  { id: "fsh2", title: "Naran River Angling", category: "fishing", categoryLabel: "Fishing", location: "Naran", price: 4500, unit: "person", rating: 4.5, reviews: 19, image: "https://loremflickr.com/900/600/fishing,river,rod?lock=79" },
  { id: "fsh3", title: "Khaplu Shyok Fishing Trip", category: "fishing", categoryLabel: "Fishing", location: "Khaplu", price: 5500, unit: "person", rating: 4.7, reviews: 23, image: "https://loremflickr.com/900/600/fishing,river,mountain?lock=80" },

  /* ---- Boating ---- */
  { id: "bt1", title: "Attabad Lake Boat Ride", category: "boating", categoryLabel: "Boating", location: "Hunza", price: 4000, unit: "person", rating: 4.6, reviews: 112, image: "https://loremflickr.com/900/600/boat,lake,turquoise?lock=81" },
  { id: "bt2", title: "Shangrila Lake Boating", category: "boating", categoryLabel: "Boating", location: "Skardu", price: 3500, unit: "person", rating: 4.5, reviews: 74, image: "https://loremflickr.com/900/600/boat,lake,resort?lock=82" },
  { id: "bt3", title: "Upper Kachura Lake Boating", category: "boating", categoryLabel: "Boating", location: "Skardu", price: 3000, unit: "person", rating: 4.4, reviews: 49, image: "https://loremflickr.com/900/600/boat,lake,blue?lock=83" },

  /* ---- Cultural Tours ---- */
  { id: "ct1", title: "Baltit & Altit Fort Tour", category: "cultural-tours", categoryLabel: "Cultural Tour", location: "Hunza", price: 8000, unit: "person", rating: 4.8, reviews: 66, image: "https://loremflickr.com/900/600/fort,heritage,hunza?lock=84" },
  { id: "ct2", title: "Shigar Fort Heritage Walk", category: "cultural-tours", categoryLabel: "Cultural Tour", location: "Shigar", price: 7000, unit: "person", rating: 4.7, reviews: 38, image: "https://loremflickr.com/900/600/fort,heritage,old?lock=85" },
  { id: "ct3", title: "Khaplu Palace Cultural Tour", category: "cultural-tours", categoryLabel: "Cultural Tour", location: "Khaplu", price: 7500, unit: "person", rating: 4.8, reviews: 42, image: "https://loremflickr.com/900/600/palace,heritage,culture?lock=86" },

  /* ---- Roadside: Bike Puncture ---- */
  { id: "rbp1", title: "Hunza Bike Puncture Help", category: "bike-puncture", categoryLabel: "Roadside Assistance", location: "Hunza", price: 1500, unit: "callout", rating: 4.5, reviews: 17, image: "https://loremflickr.com/900/600/motorbike,repair,road?lock=87" },
  { id: "rbp2", title: "Gilgit Motorbike Tyre Repair", category: "bike-puncture", categoryLabel: "Roadside Assistance", location: "Gilgit", price: 1500, unit: "callout", rating: 4.4, reviews: 12, image: "https://loremflickr.com/900/600/motorcycle,tyre,repair?lock=88" },
  { id: "rbp3", title: "Skardu Bike Roadside Fix", category: "bike-puncture", categoryLabel: "Roadside Assistance", location: "Skardu", price: 1800, unit: "callout", rating: 4.6, reviews: 15, image: "https://loremflickr.com/900/600/motorbike,roadside,help?lock=89" },

  /* ---- Roadside: Car Puncture ---- */
  { id: "rcp1", title: "Skardu Car Puncture Service", category: "car-puncture", categoryLabel: "Roadside Assistance", location: "Skardu", price: 2500, unit: "callout", rating: 4.6, reviews: 21, image: "https://loremflickr.com/900/600/car,tyre,repair?lock=90" },
  { id: "rcp2", title: "KKH Car Tyre Repair", category: "car-puncture", categoryLabel: "Roadside Assistance", location: "Gilgit", price: 2800, unit: "callout", rating: 4.5, reviews: 18, image: "https://loremflickr.com/900/600/car,wheel,roadside?lock=91" },
  { id: "rcp3", title: "Hunza Car Roadside Repair", category: "car-puncture", categoryLabel: "Roadside Assistance", location: "Hunza", price: 2500, unit: "callout", rating: 4.4, reviews: 14, image: "https://loremflickr.com/900/600/car,repair,road?lock=92" },

  /* ---- Roadside: Battery ---- */
  { id: "rbat1", title: "Gilgit Jump-Start Service", category: "battery-service", categoryLabel: "Roadside Assistance", location: "Gilgit", price: 3000, unit: "callout", rating: 4.6, reviews: 16, image: "https://loremflickr.com/900/600/car,battery,jumpstart?lock=93" },
  { id: "rbat2", title: "Skardu Battery Replacement", category: "battery-service", categoryLabel: "Roadside Assistance", location: "Skardu", price: 4500, unit: "callout", rating: 4.5, reviews: 11, image: "https://loremflickr.com/900/600/car,battery,service?lock=94" },
  { id: "rbat3", title: "Hunza Roadside Battery Help", category: "battery-service", categoryLabel: "Roadside Assistance", location: "Hunza", price: 3500, unit: "callout", rating: 4.4, reviews: 9, image: "https://loremflickr.com/900/600/battery,car,road?lock=95" },

  /* ---- Roadside: Fuel Delivery ---- */
  { id: "rfd1", title: "Skardu Emergency Fuel", category: "fuel-delivery", categoryLabel: "Roadside Assistance", location: "Skardu", price: 3000, unit: "delivery", rating: 4.6, reviews: 20, image: "https://loremflickr.com/900/600/fuel,jerrycan,car?lock=96" },
  { id: "rfd2", title: "KKH Fuel Delivery", category: "fuel-delivery", categoryLabel: "Roadside Assistance", location: "Gilgit", price: 3500, unit: "delivery", rating: 4.5, reviews: 13, image: "https://loremflickr.com/900/600/fuel,delivery,road?lock=97" },
  { id: "rfd3", title: "Deosai Route Fuel Drop", category: "fuel-delivery", categoryLabel: "Roadside Assistance", location: "Deosai", price: 5000, unit: "delivery", rating: 4.4, reviews: 8, image: "https://loremflickr.com/900/600/fuel,can,offroad?lock=98" },

  /* ---- Roadside: Vehicle Recovery ---- */
  { id: "rvr1", title: "Karakoram Towing & Recovery", category: "vehicle-recovery", categoryLabel: "Roadside Assistance", location: "Gilgit", price: 12000, unit: "callout", rating: 4.7, reviews: 24, image: "https://loremflickr.com/900/600/tow,truck,recovery?lock=99" },
  { id: "rvr2", title: "Skardu 4x4 Recovery", category: "vehicle-recovery", categoryLabel: "Roadside Assistance", location: "Skardu", price: 15000, unit: "callout", rating: 4.6, reviews: 19, image: "https://loremflickr.com/900/600/tow,truck,offroad?lock=100" },
  { id: "rvr3", title: "Babusar Vehicle Recovery", category: "vehicle-recovery", categoryLabel: "Roadside Assistance", location: "Naran", price: 14000, unit: "callout", rating: 4.5, reviews: 15, image: "https://loremflickr.com/900/600/recovery,truck,mountain?lock=101" },

  /* ---- Events: Festivals ---- */
  { id: "ev1", title: "Shandur Polo Festival", category: "festivals", categoryLabel: "Festival", location: "Gilgit", price: 5000, unit: "ticket", rating: 4.9, reviews: 88, image: "https://loremflickr.com/900/600/polo,festival,crowd?lock=102" },
  { id: "ev2", title: "Hunza Cherry Blossom Festival", category: "festivals", categoryLabel: "Festival", location: "Hunza", price: 3000, unit: "ticket", rating: 4.8, reviews: 64, image: "https://loremflickr.com/900/600/blossom,festival,spring?lock=103" },
  { id: "ev3", title: "Silk Route Festival", category: "festivals", categoryLabel: "Festival", location: "Skardu", price: 4000, unit: "ticket", rating: 4.7, reviews: 41, image: "https://loremflickr.com/900/600/festival,culture,music?lock=104" },

  /* ---- Events: Tourism Events ---- */
  { id: "te1", title: "GB Tourism Summit", category: "tourism-events", categoryLabel: "Tourism Event", location: "Gilgit", price: 6000, unit: "ticket", rating: 4.6, reviews: 22, image: "https://loremflickr.com/900/600/conference,summit,event?lock=105" },
  { id: "te2", title: "Skardu Winter Tourism Expo", category: "tourism-events", categoryLabel: "Tourism Event", location: "Skardu", price: 4500, unit: "ticket", rating: 4.5, reviews: 18, image: "https://loremflickr.com/900/600/winter,tourism,snow?lock=106" },
  { id: "te3", title: "Hunza Autumn Gala", category: "tourism-events", categoryLabel: "Tourism Event", location: "Hunza", price: 3500, unit: "ticket", rating: 4.7, reviews: 27, image: "https://loremflickr.com/900/600/autumn,festival,valley?lock=107" },

  /* ---- Events: Local Expos ---- */
  { id: "le1", title: "Gilgit Handicrafts Expo", category: "local-expos", categoryLabel: "Expo", location: "Gilgit", price: 1000, unit: "ticket", rating: 4.5, reviews: 16, image: "https://loremflickr.com/900/600/handicraft,expo,stall?lock=108" },
  { id: "le2", title: "Hunza Dry Fruit Expo", category: "local-expos", categoryLabel: "Expo", location: "Hunza", price: 1000, unit: "ticket", rating: 4.6, reviews: 21, image: "https://loremflickr.com/900/600/dryfruit,market,expo?lock=109" },
  { id: "le3", title: "Skardu Gemstone Expo", category: "local-expos", categoryLabel: "Expo", location: "Skardu", price: 1500, unit: "ticket", rating: 4.4, reviews: 12, image: "https://loremflickr.com/900/600/gemstone,expo,stall?lock=110" },

  /* ---- Events: Adventure Events ---- */
  { id: "ae1", title: "Karakoram Bike Rally", category: "adventure-events", categoryLabel: "Adventure Event", location: "Gilgit", price: 8000, unit: "ticket", rating: 4.7, reviews: 33, image: "https://loremflickr.com/900/600/bike,rally,mountain?lock=111" },
  { id: "ae2", title: "Deosai Trail Marathon", category: "adventure-events", categoryLabel: "Adventure Event", location: "Deosai", price: 6000, unit: "ticket", rating: 4.6, reviews: 25, image: "https://loremflickr.com/900/600/marathon,trail,run?lock=112" },
  { id: "ae3", title: "K2 Expedition Meet", category: "adventure-events", categoryLabel: "Adventure Event", location: "Skardu", price: 10000, unit: "ticket", rating: 4.8, reviews: 19, image: "https://loremflickr.com/900/600/expedition,climbing,snow?lock=113" },

  /* ---- Events: Cultural Events ---- */
  { id: "ce1", title: "Balti Heritage Night", category: "cultural-events", categoryLabel: "Cultural Event", location: "Skardu", price: 2500, unit: "ticket", rating: 4.7, reviews: 29, image: "https://loremflickr.com/900/600/culture,heritage,night?lock=114" },
  { id: "ce2", title: "Hunza Music & Dance Evening", category: "cultural-events", categoryLabel: "Cultural Event", location: "Hunza", price: 2000, unit: "ticket", rating: 4.6, reviews: 34, image: "https://loremflickr.com/900/600/music,dance,culture?lock=115" },
  { id: "ce3", title: "Shigar Folk Cultural Night", category: "cultural-events", categoryLabel: "Cultural Event", location: "Shigar", price: 2200, unit: "ticket", rating: 4.5, reviews: 20, image: "https://loremflickr.com/900/600/folk,music,heritage?lock=116" },
];

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

export const testimonials: Testimonial[] = [
  {
    name: "Ahmed Raza",
    city: "Lahore, Pakistan",
    quote:
      "Amazing experience! Everything was well organized and the team is very cooperative.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    name: "Sara Khan",
    city: "Karachi, Pakistan",
    quote:
      "Best tour of my life. The views, the people and the hospitality were beyond amazing.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?img=45",
  },
  {
    name: "Usman Ali",
    city: "Islamabad, Pakistan",
    quote:
      "Highly recommended! I booked a tour package and photographer through Rego.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?img=33",
  },
  {
    name: "Fatima Noor",
    city: "Multan, Pakistan",
    quote: "Very professional and trustworthy platform for traveling in GB.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?img=47",
  },
];
