import type { Money } from "./types";

/* ============================================================
 * Display helpers.
 *
 * One place, because a fare rendered two different ways on two
 * screens reads as a price change to the person paying it.
 * ============================================================ */

/**
 * Money for display. Amounts are minor units, so divide once, here.
 *
 * No decimals on PKR: nobody quotes paisa, and "PKR 85,000.00" is noise on a
 * results page where the eye is scanning a column of numbers.
 */
export function formatMoney(m: Money, opts?: { withCode?: boolean }): string {
  const major = m.amount / 100;
  const decimals = m.currency === "PKR" || m.currency === "JPY" ? 0 : 2;
  const n = major.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return opts?.withCode === false ? n : `${m.currency} ${n}`;
}

/** "7h 25m", "55m". Hours first because that is what people compare. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * The clock time at the airport, from an ISO string carrying an offset.
 *
 * Deliberately NOT converted to the viewer's zone. A departure is 07:15 in
 * Islamabad whether you are reading it in Karachi or Kuala Lumpur, and
 * showing anything else is how people miss flights.
 */
export function formatTime(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return "--:--";
  return `${m[1]}:${m[2]}`;
}

/** "Tue 16 Sep" — read off the string, for the same reason as formatTime. */
export function formatDateShort(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Days gained or lost between departure and arrival, as "+1" / "−1".
 *
 * Compared on the local calendar dates in each ISO string, not on elapsed
 * time — a 10-hour flight can cross midnight or not depending on where it
 * lands, and arriving "the next day" is what the traveller needs to plan for.
 */
export function dayOffset(departureIso: string, arrivalIso: string): string | null {
  const dep = departureIso.slice(0, 10);
  const arr = arrivalIso.slice(0, 10);
  if (dep === arr) return null;

  const diff = Math.round(
    (Date.parse(`${arr}T00:00:00Z`) - Date.parse(`${dep}T00:00:00Z`)) / 86_400_000
  );
  if (diff === 0) return null;
  return diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
}

export function stopsLabel(stopCount: number): string {
  if (stopCount === 0) return "Direct";
  if (stopCount === 1) return "1 stop";
  return `${stopCount} stops`;
}

/** Baggage in one short line, or null when the fare does not say. */
export function baggageLabel(b: {
  checkedPieces: number | null;
  checkedWeightKg: number | null;
  note: string | null;
}): string | null {
  if (b.note) return b.note;
  if (b.checkedPieces === 0) return "Cabin bag only";
  if (b.checkedPieces && b.checkedWeightKg) {
    return `${b.checkedPieces} × ${b.checkedWeightKg}kg checked`;
  }
  if (b.checkedPieces) return `${b.checkedPieces} checked bag${b.checkedPieces > 1 ? "s" : ""}`;
  if (b.checkedWeightKg) return `${b.checkedWeightKg}kg checked`;
  return null;
}
