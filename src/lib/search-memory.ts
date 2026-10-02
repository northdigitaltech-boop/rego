"use client";

/* ============================================================
 * Search memory — recent searches and the last filter set.
 *
 * Stored in localStorage only. Nothing here is sent to the server or tied
 * to an account: it is a convenience for the person on this device, and it
 * disappears when they clear their browser.
 * ============================================================ */

const RECENT_KEY = "rego_recent_searches";
const FILTERS_KEY = "rego_last_search";
const MAX_RECENT = 6;

export interface RecentSearch {
  /** What they typed or picked, e.g. "Hunza". */
  label: string;
  /** Where it led, when they picked a suggestion. */
  href?: string;
  /** Which service tab was active. */
  service?: string;
  at: number;
}

export interface SavedFilters {
  service?: string;
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  at: number;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — recent searches aren't worth an error */
  }
}

/* ---------------- recent searches ---------------- */

export function getRecentSearches(): RecentSearch[] {
  return read<RecentSearch[]>(RECENT_KEY, []).slice(0, MAX_RECENT);
}

export function addRecentSearch(entry: Omit<RecentSearch, "at">) {
  const label = entry.label.trim();
  if (label.length < 2) return;

  const existing = getRecentSearches().filter(
    (r) => r.label.toLowerCase() !== label.toLowerCase()
  );
  write(RECENT_KEY, [{ ...entry, label, at: Date.now() }, ...existing].slice(0, MAX_RECENT));
}

export function removeRecentSearch(label: string) {
  write(
    RECENT_KEY,
    getRecentSearches().filter(
      (r) => r.label.toLowerCase() !== label.toLowerCase()
    )
  );
}

export function clearRecentSearches() {
  write(RECENT_KEY, []);
}

/* ---------------- last used filters ---------------- */

/** Filters older than this are ignored — last month's dates aren't helpful. */
const FILTER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getSavedFilters(): SavedFilters | null {
  const f = read<SavedFilters | null>(FILTERS_KEY, null);
  if (!f) return null;
  if (Date.now() - f.at > FILTER_TTL_MS) return null;

  // Drop dates that have already passed.
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...f,
    checkIn: f.checkIn && f.checkIn >= today ? f.checkIn : undefined,
    checkOut: f.checkOut && f.checkOut >= today ? f.checkOut : undefined,
  };
}

export function saveFilters(f: Omit<SavedFilters, "at">) {
  write(FILTERS_KEY, { ...f, at: Date.now() });
}

export function clearSavedFilters() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(FILTERS_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------------- popular destinations ---------------- */

/**
 * Shown before anyone has typed anything. Ordered by real traveller demand
 * in Gilgit-Baltistan rather than alphabetically.
 */
export const POPULAR_DESTINATIONS: { label: string; href: string }[] = [
  /* Every href checked against the live sitemap. The old list pointed at
     /destinations/hunza, /fairy-meadows, /deosai, /khaplu and /shigar —
     none of which exist, so five of six suggestions opened a 404. */
  { label: "Hunza Valley", href: "/destinations/hunza-valley" },
  { label: "Skardu", href: "/destinations/skardu" },
  { label: "Gilgit", href: "/destinations/gilgit" },
  { label: "Nagar Valley", href: "/destinations/nagar-valley" },
  { label: "Astore Valley", href: "/destinations/astore-valley" },
  { label: "Ghizer Valley", href: "/destinations/ghizer-valley" },
];
