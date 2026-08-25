/* ============================================================
 * Page titles and descriptions for destination and category
 * pages.
 *
 * These pages used to title themselves with nothing but their
 * own name — "SKARDU — Rego", "Hotels & Resorts — Rego". No
 * traveller searches for that, so the pages carried no signal
 * for the queries they should have been winning ("skardu
 * hotels", "skardu travel guide", "tour packages gilgit
 * baltistan").
 *
 * Admin-written SEO in `location_seo` still wins over
 * everything here. This is only the fallback, which is what
 * almost every page is actually using today.
 *
 * Nothing in this file states a fact about a place. It only
 * describes what is on the page — services, listings and
 * answers — so it cannot go stale or overclaim.
 * ============================================================ */

const REGION = "Gilgit-Baltistan";

/**
 * Google truncates around 60 characters, and the root layout appends
 * " — Rego" (7 more). Titles are written to sit under that, but a long
 * destination name could still push one over, so it is enforced rather
 * than assumed.
 */
const TITLE_BUDGET = 53;

/**
 * Destination names are typed by hand in the admin, and several were entered
 * in capitals. "SKARDU" is fine as a styled heading but wrong in a title tag
 * and in a search result, where it reads as shouting.
 *
 * Only fully-uppercase words are touched — a name that already has mixed case
 * was written deliberately and is left exactly as it is.
 */
export function tidyName(raw: string): string {
  const name = raw.trim();
  if (!name) return name;
  if (/[a-z]/.test(name)) return name;          // already mixed case

  return name
    .split(/(\s+|-)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === "-") return part;
      // K2, GB and similar stay as they are; two letters or fewer with a
      // digit is an abbreviation, not a word.
      if (part.length <= 2 || /\d/.test(part)) return part;
      return part[0] + part.slice(1).toLowerCase();
    })
    .join("");
}

/** Trim to a whole word rather than cutting mid-word. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,:—-]+$/, "");
}

/* ------------------------------------------------------------------ */
/* Destinations                                                        */
/* ------------------------------------------------------------------ */

export function destinationTitle(rawName: string): string {
  const name = tidyName(rawName);
  const full = `${name} Travel Guide: Hotels, Tours & Transport`;
  /* If the name is long enough that the full form would be truncated by
     Google mid-phrase, drop to the shorter form instead of shipping a title
     that ends in half a word. */
  return full.length <= TITLE_BUDGET ? full : `${name} Travel Guide & Bookings`;
}

export function destinationDescription(rawName: string, tagline?: string | null): string {
  const name = tidyName(rawName);
  const lead = tagline?.trim()
    ? `${tagline.trim().replace(/[.\s]+$/, "")}. `
    : "";
  return clamp(
    `${lead}Plan a trip to ${name}, ${REGION} — hotels, homestays, tour packages, ` +
      `transport and local guides, with prices and answers to common questions.`,
    158
  );
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export function categoryTitle(rawName: string): string {
  const name = tidyName(rawName);
  const full = `${name} in ${REGION}`;
  return full.length <= TITLE_BUDGET ? full : name;
}

export function categoryDescription(rawName: string, tagline?: string | null): string {
  const name = tidyName(rawName);
  const lead = tagline?.trim() ? `${tagline.trim().replace(/[.\s]+$/, "")}. ` : "";
  return clamp(
    `${lead}Browse ${name.toLowerCase()} across ${REGION} on Rego — ` +
      `compare local providers, see prices, and book or message them directly.`,
    158
  );
}
