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
  kind: "search" | "weather" | "reasoning" | "other";
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
    "hotel", "hotels", "resort", "resorts", "accommodation", "accomodation",
    "stay", "stays", "staying", "room", "rooms", "lodge", "lodging", "motel",
    "place to stay", "where to stay", "where can i stay", "somewhere to stay",
    "night stay", "book a room", "hotal", "hottel",
    "rehna", "thehrna", "kamra", "kamray", "sasta hotel", "kam price hotel", "ہوٹل", "کمرہ",
  ],
  search_homestays: [
    "homestay", "home stay", "guest house", "guesthouse", "host family", "local stay", "گیسٹ ہاؤس",
  ],
  search_hostels: ["hostel", "hostels", "dorm", "dormitory", "bunk", "backpacker"],
  search_tour_packages: [
    "tour package", "tour packages", "packages", "package", "guided tour",
    "sightseeing", "tour", "tours", "trip package", "deal", "deals", "ٹور",
  ],
  search_transport: [
    "car rent", "rent a car", "rental car", "rent car", "car chahiye", "jeep", "jeeps",
    "prado", "land cruiser", "bike", "transport", "transportation", "vehicle", "vehicles",
    "4x4", "gari", "gaari", "گاڑی", "جیپ", "car for rent", "cars for rent",
    "rental", "rentals", "driver", "drivers", "taxi", "cab", "pick and drop",
    "pickup", "how to get to", "how to reach", "travel to", "getting around",
  ],
  search_guides: [
    "tour guide", "local guide", "guide", "guides", "guiding", "trek guide",
    "mountain guide", "porter", "porters", "گائیڈ",
  ],
  search_photographers: [
    "photographer", "photographers", "photography", "drone", "drone pilot", "videographer", "photo shoot", "shoot",
  ],
  search_restaurants: [
    "restaurant", "restaurants", "resturant", "resturants", "food", "foods",
    "eat", "eating", "dining", "dine", "cafe", "cafes", "coffee", "dhaba",
    "traditional food", "local food", "where to eat", "place to eat",
    "khana", "کھانا", "ریسٹورنٹ",
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

/** Weather words — answered from LIVE Open-Meteo data, never the LLM
 * (a language model cannot know current conditions anyway). */
const WEATHER_WORDS = [
  "weather", "wether", "eather", "temperature", "mausam", "mosam", "موسم",
  "barish", "snowfall", "snowing", "raining", "kitni thand", "how cold", "how hot",
];

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

/** What the previous turns established, so follow-ups make sense. */
export interface ChatContext {
  /** Location the user was last talking about ("…and transport there?"). */
  location?: string | null;
  /** Service they were last browsing ("show me a cheaper one"). */
  intent?: SearchIntent | null;

  /* ---- added for contextual follow-up suggestions ---- */

  /** Categories already shown, so we stop offering them again. */
  explored?: SearchIntent[];
  /** They said they already have somewhere to stay. */
  hasAccommodation?: boolean;
  /** They said they have their own car / are driving themselves. */
  hasOwnVehicle?: boolean;
  /** They already have a guide, or explicitly don't want one. */
  hasGuide?: boolean;
  /** Price leaning, when they actually stated one. */
  budgetHint?: "cheap" | "premium" | null;
  /** Trip length in days, when they gave it. */
  durationDays?: number | null;
  /** Travelling alone, with family, or in a group. */
  partyKind?: "solo" | "family" | "group" | null;
}

/* ============================================================
 * Negative signals.
 *
 * "Hotel book kar liya", "I have my own car" — these are the
 * lines that separate an assistant which listens from one that
 * keeps pushing the same three buttons. Offering car rental to
 * someone who just said they're driving is the single most
 * obvious way to look like a robot.
 *
 * Deliberately narrow. A false positive here silently hides a
 * category the traveller might have wanted, which is worse than
 * showing one extra chip — so each phrase has to be unambiguous.
 * ============================================================ */

const HAVE_ACCOMMODATION = [
  "already booked", "already book", "have booked", "booked my hotel",
  "booked a hotel", "got a hotel", "have a hotel", "staying at", "staying with",
  "my hotel is", "hotel is booked", "accommodation is sorted", "place to stay sorted",
  // Roman Urdu
  "hotel book kar liya", "hotel book kr lia", "hotel mil gaya", "rehne ka intezam",
  "hotel ho gaya", "hotel ka intezam", "rukne ki jaga mil",
];

const HAVE_VEHICLE = [
  "my own car", "own car", "own vehicle", "i have a car", "i have car",
  "have my own", "driving myself", "self drive", "self-drive", "bringing my car",
  "by my own car", "i'll drive", "i will drive",
  // Roman Urdu
  "apni gari", "apni car", "khud drive", "gari hai", "meri gari",
];

const HAVE_GUIDE = [
  "already have a guide", "have a guide", "got a guide", "guide arranged",
  "don't need a guide", "dont need a guide", "no guide needed",
  "guide mil gaya", "guide ka intezam", "guide nahi chahiye",
];

const SOLO_WORDS = ["solo", "alone", "by myself", "akela", "akele"];
const FAMILY_WORDS = ["family", "wife", "husband", "kids", "children", "parents", "ghar wale", "bachay", "bache"];
const GROUP_WORDS = ["friends", "group", "colleagues", "dosto", "doston", "friends ke sath"];

const PREMIUM_WORDS = ["luxury", "premium", "5 star", "five star", "best hotel", "high end", "mehnga", "acha wala"];

/** Trip length: "5 days", "3 din", "a week". */
function detectDuration(q: string): number | null {
  if (/\b(a |one )?week\b|\bhafta\b|\bhafte\b/.test(q)) return 7;
  const m = q.match(/(\d{1,2})\s*(days?|din|roz|nights?|raat)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 && n <= 60 ? n : null;
}

/**
 * Read standing facts out of the conversation.
 *
 * Only sets a field when the user actually said it — an unset field
 * stays undefined rather than being guessed at, so a suggestion is
 * never suppressed on the strength of an assumption.
 */
export function readSignals(text: string, into: ChatContext = {}): ChatContext {
  const q = text.toLowerCase();
  const ctx: ChatContext = { ...into };

  if (includesAny(q, HAVE_ACCOMMODATION)) ctx.hasAccommodation = true;
  if (includesAny(q, HAVE_VEHICLE)) ctx.hasOwnVehicle = true;
  if (includesAny(q, HAVE_GUIDE)) ctx.hasGuide = true;

  if (!ctx.budgetHint) {
    if (includesAny(q, CHEAP_WORDS)) ctx.budgetHint = "cheap";
    else if (includesAny(q, PREMIUM_WORDS)) ctx.budgetHint = "premium";
  }

  if (ctx.durationDays == null) {
    const d = detectDuration(q);
    if (d) ctx.durationDays = d;
  }

  if (!ctx.partyKind) {
    if (includesAny(q, FAMILY_WORDS)) ctx.partyKind = "family";
    else if (includesAny(q, GROUP_WORDS)) ctx.partyKind = "group";
    else if (includesAny(q, SOLO_WORDS)) ctx.partyKind = "solo";
  }

  return ctx;
}

/**
 * Follow-ups that only make sense with context — "a cheaper one", "what about
 * there", "any others". These carry the previous intent/location forward.
 */
const FOLLOW_UP_SIGNALS = [
  "cheaper", "cheapest one", "another", "other one", "others", "any other",
  "what about", "how about", "there", "that one", "this one", "same",
  "instead", "alternative", "alternatives", "more options", "show more",
  "aur", "aur koi", "dusra", "doosra", "wahan", "koi aur",
];

export function classifyQuery(raw: string, ctx: ChatContext = {}): RouteDecision {
  const q = raw.toLowerCase().trim();

  // Resolve "there"/"same place" to the location from earlier in the chat.
  const location = detectLoc(q) ?? (ctx.location ?? null);
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

  // "show me a cheaper one" names no service — inherit it from the last turn.
  const isFollowUp = !!includesAny(q, FOLLOW_UP_SIGNALS);
  if (!intent && isFollowUp && ctx.intent) intent = ctx.intent;

  const filters: RouteDecision["filters"] = {
    location,
    maxPrice: maxPrice ?? (cheap ? 15000 : null),
    sort: cheap || maxPrice ? "price_ascending" : top ? "rating_descending" : null,
    verifiedOnly,
  };

  // Live-data intents beat everything: current weather comes from Open-Meteo,
  // not a language model (which cannot know real-time conditions).
  if (includesAny(q, WEATHER_WORDS)) {
    return { kind: "weather", intent, confidence: 0.92, filters };
  }

  // Reasoning signals always win — even "recommend hotels in Hunza" needs the model.
  if (reasoning) return { kind: "reasoning", intent, confidence: 0.9, filters };

  // Questions ("how is…", "is it…", "are you…", "kya…") usually need
  // understanding rather than a listing dump — BUT a short question that names
  // a service is really just a search ("where can I stay in Hunza?",
  // "any cheaper hotels?"), so only send the open-ended ones to the model.
  const asksQuestion = includesAny(q, INTERROGATIVES) || q.endsWith("?");
  const givesCommand = includesAny(q, SEARCH_VERBS);
  const wordCount = q.split(/\s+/).length;
  const simpleLookup = !!intent && wordCount <= 12;
  if (asksQuestion && !givesCommand && !simpleLookup) {
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

/* ---------------- live weather (Open-Meteo, no AI) ---------------- */

const WEATHER_COORDS: Record<string, { lat: number; lon: number }> = {
  Skardu: { lat: 35.3, lon: 75.63 },
  Gilgit: { lat: 35.92, lon: 74.31 },
  Hunza: { lat: 36.32, lon: 74.65 },
  Nagar: { lat: 36.26, lon: 74.72 },
  Astore: { lat: 35.37, lon: 74.86 },
  Ghizer: { lat: 36.17, lon: 73.77 },
  Diamer: { lat: 35.2, lon: 73.6 },
  Khaplu: { lat: 35.16, lon: 76.33 },
  Shigar: { lat: 35.42, lon: 75.73 },
  Deosai: { lat: 34.97, lon: 75.4 },
  "Fairy Meadows": { lat: 35.38, lon: 74.58 },
  Naltar: { lat: 36.17, lon: 74.18 },
  Attabad: { lat: 36.35, lon: 74.87 },
  Passu: { lat: 36.48, lon: 74.88 },
  Karimabad: { lat: 36.33, lon: 74.66 },
  Naran: { lat: 34.9, lon: 73.65 },
  Chilas: { lat: 35.42, lon: 74.1 },
};

function weatherText(code: number): string {
  if (code === 0) return "clear skies";
  if (code <= 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "foggy";
  if (code <= 57) return "light drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  return "thunderstorms";
}

/** Answer "what's the weather in X" from live Open-Meteo data — zero AI tokens. */
export async function answerWeather(location: string | null): Promise<DbAnswer | null> {
  const loc = location && WEATHER_COORDS[location] ? location : "Skardu";
  const { lat, lon } = WEATHER_COORDS[loc];
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`,
      { next: { revalidate: 900 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data?.current;
    if (!cur) return null;
    const temp = Math.round(Number(cur.temperature_2m));
    const desc = weatherText(Number(cur.weather_code));
    const wind = Math.round(Number(cur.wind_speed_10m));
    const hi = Math.round(Number(data?.daily?.temperature_2m_max?.[0]));
    const lo = Math.round(Number(data?.daily?.temperature_2m_min?.[0]));

    const rough = Number(cur.weather_code) >= 61 || temp <= 0;
    const verdict = rough
      ? "Conditions look rough — travel with care, and check Road Updates & Alerts before heading out."
      : "Looks fine for getting out and about — still worth a glance at Road Updates & Alerts before long drives.";

    return {
      reply:
        `Right now in ${loc}: ${temp}°C with ${desc}, wind ${wind} km/h` +
        (Number.isFinite(hi) && Number.isFinite(lo) ? ` (today ${lo}°–${hi}°C).` : ".") +
        ` ${verdict}`,
      results: [],
      viewAllHref: "/roadside/updates",
    };
  } catch {
    return null;
  }
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
