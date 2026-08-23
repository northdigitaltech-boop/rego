import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Answers — the read layer and the content-quality rules.
 *
 * ---------------------------------------------------------------------------
 * PUBLIC READS NEVER TOUCH THE TABLE DIRECTLY.
 *
 * They go through get_published_answers(), a security-definer function that
 * filters to published, in-window, and attached to an active public area.
 * The `answers` table has no policy for anonymous users at all, so a
 * hand-written client query returns nothing rather than a draft.
 *
 * If the workflow could be bypassed by one careless select, the workflow is
 * decoration.
 * ---------------------------------------------------------------------------
 */

export const ANSWER_TYPES = [
  "general",
  "best_time",
  "how_to_reach",
  "distance",
  "travel_duration",
  "estimated_cost",
  "accommodation",
  "transport",
  "tour_guide",
  "activities",
  "safety",
  "weather",
  "road_status",
  "booking",
  "cancellation",
  "provider_verification",
  "service_availability",
] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];

export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  general: "General",
  best_time: "Best time to visit",
  how_to_reach: "How to reach",
  distance: "Distance",
  travel_duration: "Travel duration",
  estimated_cost: "Estimated cost",
  accommodation: "Accommodation",
  transport: "Transport",
  tour_guide: "Tour guides",
  activities: "Activities",
  safety: "Safety",
  weather: "Weather",
  road_status: "Road status",
  booking: "Booking",
  cancellation: "Cancellation",
  provider_verification: "Provider verification",
  service_availability: "Service availability",
};

/** Traveller intent. Organisation only — never a URL, never a keyword page. */
export const INTENTS = [
  "discover",
  "plan",
  "compare",
  "book",
  "travel",
  "stay",
  "explore",
  "safety",
  "support",
] as const;
export type Intent = (typeof INTENTS)[number];

export const STATUSES = [
  "draft",
  "review",
  "published",
  "needs_review",
  "expired",
  "archived",
] as const;
export type AnswerStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<AnswerStatus, string> = {
  draft: "Draft",
  review: "Under review",
  published: "Published",
  needs_review: "Needs review",
  expired: "Expired",
  archived: "Archived",
};

export interface SourceRef {
  label: string;
  url: string;
}

/** What the public sees. Deliberately has no status or author fields. */
export interface PublicAnswer {
  id: string;
  question: string;
  short_answer: string;
  detailed_answer: string | null;
  answer_type: AnswerType;
  intent: Intent | null;
  source_references: SourceRef[];
  is_time_sensitive: boolean;
  last_verified_at: string | null;
  valid_until: string | null;
  is_featured: boolean;
  display_order: number;
}

/** The admin view — everything, including workflow state. */
export interface AdminAnswer extends PublicAnswer {
  status: AnswerStatus;
  entity_type: string | null;
  entity_id: string | null;
  location_id: string | null;
  service_slug: string | null;
  language_code: string;
  valid_from: string | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/* Public reads                                                        */
/* ------------------------------------------------------------------ */

export interface AnswerQuery {
  locationId?: string | null;
  service?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  language?: string;
  limit?: number;
}

/**
 * Published answers for one page.
 *
 * Returns [] on any failure. A page must never 500 because its optional FAQ
 * section could not load — the answers are an enhancement, not the page.
 */
export async function getAnswers(q: AnswerQuery = {}): Promise<PublicAnswer[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase.rpc("get_published_answers", {
      p_location_id: q.locationId ?? null,
      p_service: q.service ?? null,
      p_entity_type: q.entityType ?? null,
      p_entity_id: q.entityId ?? null,
      p_language: q.language ?? "en",
      p_limit: q.limit ?? 20,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as PublicAnswer[]).map((a) => ({
      ...a,
      source_references: Array.isArray(a.source_references) ? a.source_references : [],
    }));
  } catch {
    return [];
  }
}

/**
 * Approved listings in an area, for factual marketplace sentences.
 *
 * Returns null rather than 0 when the data cannot be trusted, so a caller can
 * fall back to "Explore what's available" instead of asserting a number.
 */
export async function getApprovedCount(
  locationId: string,
  service?: string | null
): Promise<number | null> {
  if (!isSupabaseConfigured || !locationId) return null;
  try {
    const { data, error } = await supabase.rpc("approved_listing_count", {
      p_location_id: locationId,
      p_service: service ?? null,
    });
    if (error || typeof data !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * A factual sentence about what is listed, or null.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS REFUSES TO QUOTE SMALL NUMBERS
 *
 * "REGO currently has 2 approved hotels in Skardu" is accurate and actively
 * harmful: it reads as a nearly-empty marketplace, it goes stale the moment a
 * third is approved, and it may be cached for an hour after that.
 *
 * Below the threshold the caller gets a qualitative sentence instead, which
 * stays true regardless of the exact number.
 * ---------------------------------------------------------------------------
 */
const MIN_COUNT_TO_QUOTE = 5;

export function countSentence(
  count: number | null,
  noun: string,
  place: string
): string | null {
  if (count === null) return null;
  if (count === 0) return null; // say nothing rather than advertise emptiness
  if (count < MIN_COUNT_TO_QUOTE) {
    return `${noun[0].toUpperCase()}${noun.slice(1)} are listed in ${place} on Rego.`;
  }
  return `Rego currently lists ${count} approved ${noun} in ${place}.`;
}

/* ------------------------------------------------------------------ */
/* Time sensitivity                                                    */
/* ------------------------------------------------------------------ */

export interface Freshness {
  /** Safe to present as current. */
  current: boolean;
  /** Human phrase for the UI, or null when there is nothing to say. */
  label: string | null;
  stale: boolean;
}

/** How old is too old before a time-sensitive claim needs a caveat. */
const STALE_AFTER_DAYS = 30;

export function freshness(a: PublicAnswer, now: Date = new Date()): Freshness {
  if (!a.is_time_sensitive) {
    return { current: true, label: null, stale: false };
  }

  if (a.valid_until && new Date(a.valid_until) <= now) {
    /* Should be unreachable — the SQL filters these out — but if it ever is
       reached, say so rather than presenting expired information as current. */
    return { current: false, label: "This information has expired.", stale: true };
  }

  if (!a.last_verified_at) {
    return {
      current: true,
      label: "Verification date not recorded — check before relying on this.",
      stale: true,
    };
  }

  const days = Math.floor(
    (now.getTime() - new Date(a.last_verified_at).getTime()) / 86_400_000
  );
  const when = new Date(a.last_verified_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (days > STALE_AFTER_DAYS) {
    return {
      current: true,
      label: `Last verified ${when} — conditions may have changed since.`,
      stale: true,
    };
  }
  return { current: true, label: `Last verified ${when}`, stale: false };
}

/* ------------------------------------------------------------------ */
/* Content quality                                                     */
/* ------------------------------------------------------------------ */

export interface Warning {
  field: string;
  message: string;
  /** `block` prevents publishing. `warn` is shown but does not stop you. */
  level: "block" | "warn";
}

/* Claims that need a source, because a reader cannot verify them from the
   page. Not a blocklist of "SEO words" — a list of things that are either
   true and checkable, or shouldn't be said. */
const SUPERLATIVES =
  /\b(best|biggest|largest|cheapest|number one|no\.? ?1|top rated|world[- ]class|unmatched|finest|leading|most popular)\b/i;

const ABSOLUTES = /\b(always|never|guaranteed|100%|all travellers|everyone)\b/i;

/**
 * Validate an answer before it is published.
 *
 * Returns warnings rather than silently refusing, because most weak content
 * is fixable and an editor who cannot see why is stuck. Only genuinely unsafe
 * content is blocked.
 */
export function validateAnswer(a: {
  question: string;
  short_answer: string;
  detailed_answer?: string | null;
  answer_type?: string;
  is_time_sensitive?: boolean;
  valid_until?: string | null;
  last_verified_at?: string | null;
  source_references?: SourceRef[];
}): Warning[] {
  const w: Warning[] = [];
  const q = (a.question || "").trim();
  const s = (a.short_answer || "").trim();
  const body = `${s} ${a.detailed_answer ?? ""}`;

  if (!q) w.push({ field: "question", message: "Question is required.", level: "block" });
  else if (!q.includes("?") && q.split(/\s+/).length < 3) {
    w.push({
      field: "question",
      message: "This does not read as a traveller's question.",
      level: "warn",
    });
  }

  if (!s) {
    w.push({ field: "short_answer", message: "Short answer is required.", level: "block" });
  } else {
    if (s.length < 40) {
      w.push({
        field: "short_answer",
        message: "Very short — does this actually answer the question on its own?",
        level: "warn",
      });
    }
    if (s.length > 600) {
      w.push({
        field: "short_answer",
        message: "Long for a direct answer. Move detail into the detailed answer.",
        level: "warn",
      });
    }
  }

  const sup = body.match(SUPERLATIVES);
  if (sup && (a.source_references ?? []).length === 0) {
    w.push({
      field: "short_answer",
      message: `"${sup[0]}" is an unverifiable claim without a source. Remove it or cite one.`,
      level: "warn",
    });
  }

  const abs = body.match(ABSOLUTES);
  if (abs) {
    w.push({
      field: "short_answer",
      message: `"${abs[0]}" is an absolute claim. Travel conditions rarely justify one.`,
      level: "warn",
    });
  }

  /* A bare number with no source is the most common way a travel answer goes
     quietly wrong — prices and distances change and nobody re-checks. */
  const hasFigures = /\b(PKR|Rs\.?|\$)\s?[\d,]+|\b\d{2,}\s?(km|hours?|hrs?|days?)\b/i.test(body);
  if (hasFigures && (a.source_references ?? []).length === 0) {
    w.push({
      field: "source_references",
      message: "Contains prices, distances or durations but cites no source.",
      level: "warn",
    });
  }

  if (a.is_time_sensitive) {
    if (!a.valid_until) {
      w.push({
        field: "valid_until",
        message: "Time-sensitive answers must have an expiry date.",
        level: "block",
      });
    }
    if (!a.last_verified_at) {
      w.push({
        field: "last_verified_at",
        message: "Record when this was last verified.",
        level: "block",
      });
    }
    if ((a.source_references ?? []).length === 0) {
      w.push({
        field: "source_references",
        message: "Time-sensitive information needs a source readers can check.",
        level: "warn",
      });
    }
  }

  if (a.answer_type === "road_status") {
    /* The road system is live and updated by reporters. A hand-written road
       answer will be wrong within days and will contradict the page beside
       it. */
    w.push({
      field: "answer_type",
      message:
        "Road conditions change daily. Link to /roadside/updates rather than stating a status here.",
      level: "warn",
    });
  }

  for (const ref of a.source_references ?? []) {
    if (!ref.url) continue;
    if (!/^https?:\/\//i.test(ref.url)) {
      w.push({
        field: "source_references",
        message: `"${ref.url}" is not a valid http(s) URL.`,
        level: "block",
      });
    }
  }

  return w;
}

export const canPublish = (w: Warning[]) => !w.some((x) => x.level === "block");
