import { type Listing } from "@/lib/data";
import { getHotels } from "@/lib/hotels";
import { getHomestays } from "@/lib/homestays";
import { getHostels } from "@/lib/hostels";
import {
  getApprovedPackages,
  getApprovedGuides,
  packageToListing,
  guideToListing,
} from "@/lib/tour-companies";
import {
  getApprovedRentals,
  getApprovedServices,
  rentalToListing,
  serviceToListing,
} from "@/lib/transport";
import { getApprovedMediaProviders, providerToListing } from "@/lib/media";
import { getApprovedRestaurants, restaurantToListing } from "@/lib/restaurants";

/* ============================================================
 * REGO SMART QUERY ROUTER — database first, AI only when required.
 *
 * A local, rule-based intent classifier (keywords + regex + entity lists, in
 * English / Urdu script / Roman Urdu). Simple listing searches are answered
 * straight from the live Supabase catalogue with template replies and NEVER
 * call the LLM. Only reasoning/planning/comparison queries go to the model —
 * and even then only a compact structured context is sent, never raw tables.
 *
 * Flow: DATABASE FIRST → BUSINESS LOGIC SECOND → AI LAST.
 * ============================================================ */

export type SearchIntent =
  | "search_hotels"
  | "search_homestays"
  | "search_hostels"
  | "search_tour_packages"
  | "search_transport"
  | "search_guides"
  | "search_photographers"
  | "search_restaurants";

export interface RouteDecision {
  kind: "search" | "reasoning" | "other";
  intent?: SearchIntent;
  confidence: number;
  filters: {
    location: string | null;
    maxPrice: number | null;
    sort: "price_ascending" | "rating_descending" | null;
    verifiedOnly: boolean;
  };
}

/* ---------------- entity dictionaries ---------------- */

const LOCATIONS = [
  "skardu", "gilgit", "hunza", "nagar", "astore", "ghizer", "diamer", "khaplu",
  "shigar", "roundu", "deosai", "fairy meadows", "fairy meadow", "naltar",
  "attabad", "passu", "karimabad", "naran", "chilas", "gupis", "yasin",
];

const CANONICAL: Record<string, string> = {
  "fairy meadow": "Fairy Meadows",
};

/** intent → keyword list (English + Urdu script + Roman Urdu). */
const INTENT_KEYWORDS: Record<SearchIntent, string[]> = {
  search_hotels: [
    "hotel", "hotels", "resort", "accommodation", "stay", "room", "rooms", "lodge",
    "rehna", "thehrna", "kamra", "kamray", "sasta hotel", "kam price hotel", "ہوٹل", "کمرہ",
  ],
  search_homestays: [
    "homestay", "home stay", "guest house", "guesthouse", "host family", "local stay", "گیسٹ ہاؤس",
  ],
  search_hostels: ["hostel", "hostels", "dorm", "dormitory", "bunk", "backpacker"],
  search_tour_packages: [
    "tour package", "packages", "package", "guided tour", "sightseeing", "tour", "ٹور",
  ],
  search_transport: [
    "car rent", "rent a car", "rental car", "rent car", "car chahiye", "jeep", "prado",
    "land cruiser", "bike", "transport", "vehicle", "4x4", "gari", "gaari", "گاڑی", "جیپ",
    "car for rent", "cars for rent", "rental", "rentals", "driver",
  ],
  search_guides: ["tour guide", "local guide", "guide", "guides", "گائیڈ"],
  search_photographers: [
    "photographer", "photographers", "photography", "drone", "drone pilot", "videographer", "photo shoot", "shoot",
  ],
  search_restaurants: [
    "restaurant", "restaurants", "food", "eat", "dining", "cafe", "traditional food", "khana", "کھانا", "ریسٹورنٹ",
  ],
};

const CHEAP_WORDS = [
  "cheap", "cheapest", "low price", "affordable", "budget", "economical",
  "kam price", "sasta", "sasti", "sab se sasta", "کم قیمت", "سستا",
];
const TOP_WORDS = [
  "best", "top", "top rated", "top-rated", "highly rated", "acha", "achha", "بہترین",
];
const VERIFIED_WORDS = ["verified", "trusted", "authentic", "تصدیق"];

/** Words that mean the user needs reasoning/planning — AI territory. */
const REASONING_SIGNALS = [
  "plan", "itinerary", "compare", "recommend", "recomend", "suggest", "which is better",
  "better for", "honeymoon", "route from", "best route", "how do i", "how to",
  "should i", "what should", "explain", "why", "history", "culture", "cultural",
  "weather", "wether", "eather", "climate", "temperature", "mausam", "barish", "snowfall",
  "best time", "advice", "elderly", "children", "family trip",
  "day trip", "days trip", "budget of", "according to", "customise", "customize",
  "mashwara", "batao", "کیسے", "کون سا بہتر", "موسم",
];

/** Question words — questions need understanding, not a listing dump. */
const INTERROGATIVES = [
  "how", "why", "should", "would", "which", "what", "when", "is it", "are you",
  "can i", "can we", "do you", "kya", "kaisa", "kesa", "kab",
];

/** Command verbs that clearly ask for a listing search. */
const SEARCH_VERBS = ["show", "find", "list", "search", "dikhao", "chahiye", "browse"];

/* ---------------- detection helpers ---------------- */

function detectLoc(q: string): string | null {
  for (const l of LOCATIONS) {
    if (q.includes(l)) {
      const canon = CANONICAL[l] ?? l;
      return canon
        .split(" ")
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(" ");
    }
  }
  return null;
}

function detectMaxPrice(q: string): number | null {
  // "under 5000", "below PKR 10,000", "upto 8k"
  let m = q.match(/(?:under|below|less than|max|upto|up to)\s*(?:pkr|rs\.?)?\s*([\d,]+)\s*(k)?/i);
  if (!m) {
    // Roman Urdu: "5000 se kam", "10,000 say kam"
    m = q.match(/([\d,]+)\s*(k)?\s*(?:se|say)\s*kam/i);
  }
  if (m) {
    let n = Number(m[1].replace(/,/g, ""));
    if (m[2]) n *= 1000;
    if (n > 0) return n;
  }
  return null;
}

/**
 * Word-boundary aware term match, so "eat" never matches inside "weather" and
 * "tour" never matches "tourism" incorrectly hurting longer keys. Urdu-script
 * terms use plain substring matching (no \b semantics in Arabic script).
 */
function hasTerm(q: string, term: string): boolean {
  if (/[؀-ۿ]/.test(term)) return q.includes(term);
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`, "i").test(q);
}

function includesAny(q: string, words: string[]): string | null {
  let best: string | null = null;
  for (const w of words) if (hasTerm(q, w) && (!best || w.length > best.length)) best = w;
  return best;
}

/* ---------------- the classifier ---------------- */

export function classifyQuery(raw: string): RouteDecision {
  const q = raw.toLowerCase().trim();

  const location = detectLoc(q);
  const maxPrice = detectMaxPrice(q);
  const cheap = includesAny(q, CHEAP_WORDS);
  const top = includesAny(q, TOP_WORDS);
  const verifiedOnly = !!includesAny(q, VERIFIED_WORDS);
  const reasoning = includesAny(q, REASONING_SIGNALS);

  // Longest-keyword-wins intent match ("tour guide" beats "tour").
  let intent: SearchIntent | undefined;
  let bestLen = 0;
  for (const [name, words] of Object.entries(INTENT_KEYWORDS) as [SearchIntent, string[]][]) {
    for (const w of words) {
      if (hasTerm(q, w) && w.length > bestLen) {
        intent = name;
        bestLen = w.length;
      }
    }
  }

  const filters: RouteDecision["filters"] = {
    location,
    maxPrice: maxPrice ?? (cheap ? 15000 : null),
    sort: cheap || maxPrice ? "price_ascending" : top ? "rating_descending" : null,
    verifiedOnly,
  };

  // Reasoning signals always win — even "recommend hotels in Hunza" needs the model.
  if (reasoning) return { kind: "reasoning", intent, confidence: 0.9, filters };

  // Questions ("how is…", "is it…", "are you…", "kya…") need understanding,
  // not a listing dump — unless the user clearly issued a search command.
  const asksQuestion = includesAny(q, INTERROGATIVES) || q.endsWith("?");
  const givesCommand = includesAny(q, SEARCH_VERBS);
  if (asksQuestion && !givesCommand) {
    return { kind: "reasoning", intent, confidence: 0.85, filters };
  }

  if (intent) {
    // Confidence: keyword hit is a strong base; location/price add certainty.
    let confidence = 0.78;
    if (location) confidence += 0.1;
    if (maxPrice || cheap || top) confidence += 0.06;
    if (q.split(/\s+/).length > 18) confidence -= 0.15; // long prose → less certain
    return { kind: "search", intent, confidence: Math.min(0.98, confidence), filters };
  }

  return { kind: "other", confidence: 0.3, filters };
}

/* ---------------- live database search (no AI) ---------------- */

const FETCHERS: Record<SearchIntent, () => Promise<Listing[]>> = {
  search_hotels: () => getHotels(),
  search_homestays: () => getHomestays(),
  search_hostels: () => getHostels(),
  search_tour_packages: async () => (await getApprovedPackages()).map(packageToListing),
  search_transport: async () => {
    const [rentals, services] = await Promise.all([getApprovedRentals(), getApprovedServices()]);
    return [...rentals.map(rentalToListing), ...services.map(serviceToListing)];
  },
  search_guides: async () => (await getApprovedGuides()).map(guideToListing),
  search_photographers: async () => (await getApprovedMediaProviders()).map(providerToListing),
  search_restaurants: async () => (await getApprovedRestaurants()).map(restaurantToListing),
};

const INTENT_LABEL: Record<SearchIntent, string> = {
  search_hotels: "hotels",
  search_homestays: "homestays & guest houses",
  search_hostels: "hostels",
  search_tour_packages: "tour packages",
  search_transport: "transport & rentals",
  search_guides: "tour guides",
  search_photographers: "photographers",
  search_restaurants: "restaurants",
};

const INTENT_HREF: Record<SearchIntent, string> = {
  search_hotels: "/categories/hotels",
  search_homestays: "/categories/homestays",
  search_hostels: "/categories/hostels",
  search_tour_packages: "/categories/tours",
  search_transport: "/categories/transport",
  search_guides: "/categories/guides",
  search_photographers: "/categories/photographers",
  search_restaurants: "/categories/restaurants",
};

export interface DbAnswer {
  reply: string;
  results: Listing[];
  viewAllHref: string;
}

/**
 * Answer a search intent straight from the live catalogue: filter, sort,
 * template — zero AI tokens. Falls back to a friendly no-results reply.
 */
export async function answerFromDatabase(d: RouteDecision): Promise<DbAnswer | null> {
  if (d.kind !== "search" || !d.intent) return null;
  let pool: Listing[] = [];
  try {
    pool = await FETCHERS[d.intent]();
  } catch {
    return null; // let the caller fall back to the static catalogue
  }
  if (pool.length === 0) return null;

  const { location, maxPrice, sort } = d.filters;
  let out = pool;
  if (location) {
    const l = location.toLowerCase();
    out = out.filter((x) => x.location.toLowerCase().includes(l));
  }
  if (maxPrice) out = out.filter((x) => x.price === 0 || x.price <= maxPrice);

  const label = INTENT_LABEL[d.intent];
  const where = location ? ` in ${location}` : " across Gilgit-Baltistan";
  const under = maxPrice ? ` under PKR ${maxPrice.toLocaleString()}` : "";

  if (out.length === 0) {
    return {
      reply:
        `No matching ${label} are currently available${where}${under}. ` +
        `You can increase the budget, try a nearby location, or browse everything on Rego.`,
      results: [],
      viewAllHref: INTENT_HREF[d.intent],
    };
  }

  if (sort === "price_ascending") {
    out = [...out].sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  } else if (sort === "rating_descending") {
    out = [...out].sort((a, b) => b.rating - a.rating);
  } else {
    out = [...out].sort(
      (a, b) => Number(!!b.featured) - Number(!!a.featured) || b.rating - a.rating
    );
  }
  const results = out.slice(0, 6);

  const opening =
    sort === "price_ascending"
      ? `Here are the most affordable ${label}${where}${under}`
      : sort === "rating_descending"
        ? `Here are the top-rated ${label}${where}`
        : `Here are ${label}${where}${under}`;

  return {
    reply: `${opening} — ${results.length} matching option${results.length === 1 ? "" : "s"} found. Tap any card to view details or book.`,
    results,
    viewAllHref: INTENT_HREF[d.intent],
  };
}
