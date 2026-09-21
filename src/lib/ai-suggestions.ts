import type { ChatContext, SearchIntent } from "@/lib/ai-router";

/* ============================================================
 * Contextual follow-up suggestions.
 *
 * WHY THIS IS COMPUTED IN CODE, NOT ASKED OF THE LLM
 *
 * The obvious design is to have the model emit a suggestions
 * array as JSON. We don't, for three reasons:
 *
 *   1. The model can name a category Rego does not have, and a
 *      chip that leads nowhere is worse than no chip.
 *   2. JSON parsing fails silently and intermittently; a chip row
 *      that vanishes on some replies looks broken.
 *   3. It costs tokens on every single turn for something that is
 *      pure logic over facts we already computed.
 *
 * Deriving them from the RouteDecision we already have gives
 * controlled category mappings by construction — every chip maps
 * to a real Rego category or a real Rego page, always.
 *
 * WHAT THIS FILE DOES NOT DO: it never touches the database and
 * never invents a listing, a price or a business. It only decides
 * which QUESTION to offer next. The answer to that question comes
 * from the existing DB-first router.
 * ============================================================ */

export type SuggestionAction = "marketplace_search" | "explore" | "plan";

export interface Suggestion {
  /** Short, action-led label. Never "Learn more". */
  title: string;
  /** Icon name for the UI to map — no emoji in the data layer. */
  icon: string;
  action: SuggestionAction;
  /** Rego category, for marketplace_search chips. */
  category?: SearchIntent;
  /** The message sent back through the normal chat endpoint on click. */
  query: string;
}

/** Never more than this, however tempting. A wall of chips reads as spam. */
export const MAX_SUGGESTIONS = 4;
/** The normal number. */
const TARGET_SUGGESTIONS = 3;

interface Candidate {
  intent?: SearchIntent;
  title: string;
  icon: string;
  action: SuggestionAction;
  /** Lower runs first — this is the order of a real trip being planned. */
  stage: number;
  /** Builds the query text, with the destination folded in. */
  query: (place: string) => string;
  /** Skip when this returns true. */
  suppressed?: (ctx: ChatContext) => boolean;
}

/* ------------------------------------------------------------
 * The catalogue.
 *
 * `stage` encodes how someone actually plans: work out where to
 * sleep, then how to move, then who shows you around, then what
 * you'll see, then where you'll eat. Offering restaurants before
 * they have a bed is the sort of thing that makes an assistant
 * feel like it isn't following along.
 * ------------------------------------------------------------ */
const CATALOGUE: Candidate[] = [
  {
    intent: "search_hotels",
    title: "Find hotels",
    icon: "hotel",
    action: "marketplace_search",
    stage: 10,
    query: (p) => (p ? `Show me hotels in ${p}` : "Show me hotels"),
    suppressed: (c) => c.hasAccommodation === true,
  },
  {
    intent: "search_homestays",
    title: "Find homestays",
    icon: "home",
    action: "marketplace_search",
    stage: 11,
    query: (p) => (p ? `Show me homestays in ${p}` : "Show me homestays"),
    suppressed: (c) => c.hasAccommodation === true,
  },
  {
    intent: "search_hostels",
    title: "Budget hostels",
    icon: "bed",
    action: "marketplace_search",
    stage: 12,
    query: (p) => (p ? `Show me hostels in ${p}` : "Show me hostels"),
    suppressed: (c) => c.hasAccommodation === true,
  },
  {
    /* The title and the query both say rental, so the intent has to as
       well — otherwise tapping "Find car rentals" explored transport and
       the chip stayed on offer after it had been used. */
    intent: "search_vehicle_rental",
    title: "Find car rentals",
    icon: "car",
    action: "marketplace_search",
    stage: 20,
    query: (p) => (p ? `Show me car rentals in ${p}` : "Show me car rentals"),
    // Someone who just said they're driving does not want this.
    suppressed: (c) => c.hasOwnVehicle === true,
  },
  {
    intent: "search_guides",
    title: "Find tour guides",
    icon: "map",
    action: "marketplace_search",
    stage: 30,
    query: (p) => (p ? `Show me top tour guides in ${p}` : "Show me top tour guides"),
    suppressed: (c) => c.hasGuide === true,
  },
  {
    intent: "search_tour_packages",
    title: "Tour packages",
    icon: "package",
    action: "marketplace_search",
    stage: 31,
    query: (p) => (p ? `Show me tour packages for ${p}` : "Show me tour packages"),
  },
  {
    title: "Explore attractions",
    icon: "compass",
    action: "explore",
    stage: 40,
    query: (p) => (p ? `What are the top places to visit in ${p}?` : "What are the top places to visit?"),
  },
  {
    intent: "search_photographers",
    title: "Find photographers",
    icon: "camera",
    action: "marketplace_search",
    stage: 41,
    query: (p) => (p ? `Show me photographers in ${p}` : "Show me photographers"),
  },
  {
    intent: "search_restaurants",
    title: "Find restaurants",
    icon: "utensils",
    action: "marketplace_search",
    stage: 50,
    query: (p) => (p ? `Show me restaurants in ${p}` : "Show me restaurants"),
  },
  {
    title: "Build my itinerary",
    icon: "calendar",
    action: "plan",
    stage: 60,
    query: (p) => (p ? `Build me a day-by-day itinerary for ${p}` : "Help me plan my trip"),
  },
  {
    title: "Check road status",
    icon: "route",
    action: "explore",
    stage: 61,
    query: (p) => (p ? `What is the road status for ${p}?` : "What is the current road status?"),
  },
  {
    title: "Plan to my budget",
    icon: "wallet",
    action: "plan",
    stage: 62,
    query: (p) => (p ? `Help me plan a budget trip to ${p}` : "Help me plan a budget trip"),
  },
];

export interface SuggestInput {
  /** The category this reply just answered, so we don't offer it again. */
  answeredIntent?: SearchIntent | null;
  /** Destination established in the conversation. */
  location?: string | null;
  ctx?: ChatContext;
  /** How many listings the answer returned. Zero changes what's useful next. */
  resultCount?: number;
  /** True when the reply was a scope refusal — offer a way back in. */
  refused?: boolean;
}

/**
 * Choose the 2–3 things this traveller most plausibly needs next.
 *
 * Pure and deterministic: same conversation state in, same chips out.
 * That matters for testing, and it means a chip can never be a
 * hallucination.
 */
export function suggestFollowUps(input: SuggestInput): Suggestion[] {
  const ctx = input.ctx ?? {};
  const place = (input.location ?? ctx.location ?? "").trim();
  const explored = new Set<SearchIntent>(ctx.explored ?? []);
  if (input.answeredIntent) explored.add(input.answeredIntent);

  /* A refusal is a dead end unless we hand them a way back. Offer the
     two broadest starting points rather than a category they never
     asked about. */
  if (input.refused) {
    return [
      {
        title: "Popular destinations",
        icon: "compass",
        action: "explore",
        query: "What are the best places to visit in Gilgit-Baltistan?",
      },
      {
        title: "Plan a trip",
        icon: "calendar",
        action: "plan",
        query: "Help me plan a trip to Gilgit-Baltistan",
      },
    ];
  }

  let pool = CATALOGUE.filter((c) => {
    if (c.intent && explored.has(c.intent)) return false;
    if (c.suppressed?.(ctx)) return false;
    return true;
  });

  /* Budget stated → prefer the cheaper stay options and drop the rest,
     so "sasta hotel chahiye" doesn't come back with a luxury nudge. */
  if (ctx.budgetHint === "cheap") {
    pool = pool.filter((c) => c.intent !== "search_hotels" || explored.has("search_homestays"));
  } else if (ctx.budgetHint === "premium") {
    pool = pool.filter((c) => c.intent !== "search_hostels");
  }

  /* Nothing matched in the marketplace for this category. Pushing another
     marketplace search straight away is likely to disappoint again, so
     lead with something that always has an answer. */
  if (input.resultCount === 0) {
    pool = [...pool].sort((a, b) => {
      const aInfo = a.action !== "marketplace_search" ? 0 : 1;
      const bInfo = b.action !== "marketplace_search" ? 0 : 1;
      return aInfo - bInfo || a.stage - b.stage;
    });
  } else {
    /* Normal case: walk forward through the planning journey from
       whatever was just answered, wrapping around if we run past
       the end so there is always something to offer. */
    const from = input.answeredIntent
      ? (CATALOGUE.find((c) => c.intent === input.answeredIntent)?.stage ?? 0)
      : 0;
    pool = [...pool].sort((a, b) => {
      const ka = a.stage > from ? a.stage : a.stage + 1000;
      const kb = b.stage > from ? b.stage : b.stage + 1000;
      return ka - kb;
    });
  }

  /* A long trip is worth planning day by day; a short one usually isn't.
     Promote the itinerary chip only when they told us it's a real trip. */
  if ((ctx.durationDays ?? 0) >= 3) {
    const i = pool.findIndex((c) => c.action === "plan" && c.icon === "calendar");
    if (i > 0) pool.unshift(...pool.splice(i, 1));
  }

  /* Only offer one place-to-sleep option at a time — hotels, homestays
     and hostels in the same row is three ways of saying the same thing. */
  const STAY: SearchIntent[] = ["search_hotels", "search_homestays", "search_hostels"];
  let stayUsed = false;
  const picked: Candidate[] = [];
  for (const c of pool) {
    const isStay = !!c.intent && STAY.includes(c.intent);
    if (isStay && stayUsed) continue;
    if (isStay) stayUsed = true;
    picked.push(c);
    if (picked.length >= TARGET_SUGGESTIONS) break;
  }

  return picked.slice(0, MAX_SUGGESTIONS).map((c) => ({
    title: c.title,
    icon: c.icon,
    action: c.action,
    ...(c.intent ? { category: c.intent } : {}),
    query: c.query(place),
  }));
}

/**
 * Server-side guard before anything reaches the client.
 *
 * Cheap insurance: if the shape of a suggestion is ever built from
 * something less trustworthy than this file, a malformed or oversized
 * entry gets dropped here rather than rendered.
 */
export function validateSuggestions(list: unknown): Suggestion[] {
  if (!Array.isArray(list)) return [];
  const ok: Suggestion[] = [];
  for (const s of list) {
    if (!s || typeof s !== "object") continue;
    const c = s as Partial<Suggestion>;
    if (typeof c.title !== "string" || typeof c.query !== "string") continue;
    if (!c.title.trim() || c.title.length > 40) continue;
    if (!c.query.trim() || c.query.length > 200) continue;
    if (c.action !== "marketplace_search" && c.action !== "explore" && c.action !== "plan") continue;
    ok.push({
      title: c.title.trim(),
      icon: typeof c.icon === "string" ? c.icon : "compass",
      action: c.action,
      ...(c.category ? { category: c.category } : {}),
      query: c.query.trim(),
    });
    if (ok.length >= MAX_SUGGESTIONS) break;
  }
  return ok;
}
