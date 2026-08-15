/* ============================================================
 * Rego AI progress steps.
 *
 * The rule here: steps describe work the server ACTUALLY does for this
 * query, and they never delay the answer. If the backend replies in 200ms
 * the user sees one step flash and then the result — that speed is an
 * advantage, not something to hide behind a fake spinner.
 *
 * The only timing we add is a ~400ms floor so a very fast reply doesn't
 * flicker. That is render smoothing, not pretend thinking.
 * ============================================================ */

export interface ProgressStep {
  id: string;
  label: string;
}

/** Never let a reply render faster than this — avoids a jarring flash. */
export const MIN_VISIBLE_MS = 400;

/**
 * Total time the step sequence is paced to cover.
 *
 * Steps are spread across this window rather than run at a fixed tick, so a
 * 4-second request still has something moving at second 3 instead of sitting
 * frozen on the last line. Nothing here delays a fast answer — if the reply
 * lands at 300ms we stop immediately.
 */
export const PACE_WINDOW_MS = 5000;

/** Floor/ceiling on per-step timing so pacing stays sane at any step count. */
export const STEP_MIN_MS = 450;
export const STEP_MAX_MS = 1100;

/** Past this, warn the user it's unusually slow rather than looking stuck. */
export const SLOW_AFTER_MS = 5000;

/** Hard stop. Beyond this we give up on the server and answer locally. */
export const REQUEST_TIMEOUT_MS = 15000;

/** Spread `count` steps across the pacing window, within sane bounds. */
export function stepIntervalFor(count: number): number {
  if (count <= 1) return STEP_MAX_MS;
  const even = PACE_WINDOW_MS / count;
  return Math.min(STEP_MAX_MS, Math.max(STEP_MIN_MS, even));
}

const HOTEL = /hotel|stay|room|accommodat|resort|homestay|hostel|guest ?house/i;
const TRANSPORT = /transport|car|jeep|van|taxi|rent|vehicle|driver|bus|coaster/i;
const GUIDE = /guide|porter|trek|climb|expedition|mountaineer/i;
const FOOD = /restaurant|food|eat|dinner|lunch|cuisine|halal/i;
const ITINERARY =
  /itinerar|plan|day ?trip|\d+\s*(day|night)|week|schedule|route|tour package/i;
const ROAD = /road|weather|open|closed|landslide|snow|pass|highway|kkh/i;

/**
 * Build the step list for a query. Only steps that correspond to a search
 * we will really run are included — no filler.
 */
export function progressStepsFor(query: string): ProgressStep[] {
  const q = query.toLowerCase();
  const steps: ProgressStep[] = [
    { id: "understand", label: "Understanding your request" },
  ];

  const wantsHotel = HOTEL.test(q);
  const wantsTransport = TRANSPORT.test(q);
  const wantsGuide = GUIDE.test(q);
  const wantsFood = FOOD.test(q);
  const wantsPlan = ITINERARY.test(q);
  const wantsRoad = ROAD.test(q);

  const searchesSomething =
    wantsHotel || wantsTransport || wantsGuide || wantsFood || wantsPlan;

  if (searchesSomething) {
    steps.push({ id: "search", label: "Searching verified Rego listings" });
  }
  if (wantsHotel) steps.push({ id: "hotels", label: "Matching hotels and stays" });
  if (wantsTransport) steps.push({ id: "transport", label: "Finding available transport" });
  if (wantsGuide) steps.push({ id: "guides", label: "Finding local guides" });
  if (wantsFood) steps.push({ id: "food", label: "Looking up restaurants" });
  if (wantsRoad) steps.push({ id: "road", label: "Checking road updates" });
  if (wantsPlan) steps.push({ id: "plan", label: "Building your itinerary" });

  steps.push({ id: "ready", label: "Preparing recommendations" });
  return steps;
}
