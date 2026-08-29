/* ============================================================
 * Rules for cancelling a booking.
 *
 * Everything here is pure. The API route and the UI both read
 * their rules from this file, so the button cannot appear on a
 * booking the server will refuse, and the server cannot refuse
 * one the button offered. When those two drift apart the user
 * sees a dead button and no explanation.
 *
 * REGO HAS TEN BOOKING TABLES, NOT ONE
 *   A hotel booking and a guide booking live in different
 *   tables with different column names, and the traveller's
 *   dashboard flattens all of them into one list — which loses
 *   the only fact that says where a row came from. So a
 *   cancellation has to carry its kind, and the kind has to map
 *   to a table name from a fixed list. Never interpolate a
 *   table name that arrived in a request body.
 * ============================================================ */

/** The ten kinds, and the table each one lives in. */
export const BOOKING_TABLES = {
  hotel: "bookings",
  homestay: "homestay_bookings",
  hostel: "hostel_bookings",
  tour: "tour_bookings",
  transport: "transport_bookings",
  guide: "guide_bookings",
  media: "media_bookings",
  restaurant: "restaurant_bookings",
  activity: "activity_bookings",
  coworking: "coworking_bookings",
} as const;

export type BookingKind = keyof typeof BOOKING_TABLES;

export const BOOKING_KINDS = Object.keys(BOOKING_TABLES) as BookingKind[];

/**
 * The table for a kind, or null.
 *
 * Returns null rather than throwing, and is the ONLY way this codebase turns
 * a kind into a table name. A request body is untrusted input; a table name
 * built from one is how a string in a JSON payload becomes SQL.
 */
export function tableForKind(kind: string): string | null {
  return Object.prototype.hasOwnProperty.call(BOOKING_TABLES, kind)
    ? BOOKING_TABLES[kind as BookingKind]
    : null;
}

/**
 * The columns phase93 adds to all ten booking tables.
 *
 * Every one is optional, and that is not defensive typing — it is the shape
 * of the data. A booking made before phase93 has none of these, a booking
 * nobody cancelled will never have them, and both must still render. Marking
 * them optional means the compiler makes every reader handle that, rather
 * than each dashboard discovering it at runtime.
 *
 * The row interfaces in the booking libraries extend this, so the fields are
 * declared once instead of copied into ten places that could drift.
 */
export interface CancellationFields {
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  cancellation_note?: string | null;
  previous_status?: string | null;
}

/* ------------------------------------------------------------------ */
/* Statuses                                                            */
/* ------------------------------------------------------------------ */

/**
 * Statuses a traveller may cancel from.
 *
 * REGO writes 'pending' and 'accepted'. The others are here because the
 * voucher route already treats 'confirmed' and 'approved' as real, and
 * because bookings predate several of these decisions — a status this code
 * has never written may still be sitting in a row from months ago.
 */
const CANCELLABLE = new Set(["pending", "accepted", "approved", "confirmed"]);

/**
 * Everything else is refused, including statuses this codebase has never
 * heard of.
 *
 * That is the safe direction and it is deliberate. An unrecognised status
 * means nobody here knows what state the booking is in, and cancelling it
 * would be acting on a guess; the traveller sees no button and contacts the
 * provider instead. The alternative — treat unknown as cancellable — fails
 * silently the first time someone adds a status.
 */
export type CancelBlockReason =
  | "already_cancelled"
  | "completed"
  | "rejected"
  | "in_progress"
  | "unknown_status";

/** Whether this status may be cancelled, and if not, why. */
export function cancelEligibility(
  status: string | null | undefined
): { ok: true } | { ok: false; why: CancelBlockReason } {
  const s = (status ?? "").trim().toLowerCase();
  if (CANCELLABLE.has(s)) return { ok: true };
  if (s === "cancelled" || s === "canceled") {
    return { ok: false, why: "already_cancelled" };
  }
  if (s === "completed") return { ok: false, why: "completed" };
  if (s === "rejected" || s === "declined") return { ok: false, why: "rejected" };
  if (s === "in_progress" || s === "started" || s === "no_show") {
    return { ok: false, why: "in_progress" };
  }
  return { ok: false, why: "unknown_status" };
}

/** Convenience for the UI, which only needs the yes/no. */
export function canCancel(status: string | null | undefined): boolean {
  return cancelEligibility(status).ok;
}

/** What to tell someone whose cancellation was refused. */
export const BLOCK_MESSAGE: Record<CancelBlockReason, string> = {
  already_cancelled: "This booking has already been cancelled.",
  completed:
    "This booking is marked completed, so it can no longer be cancelled. Contact the provider if that looks wrong.",
  rejected:
    "This booking was not accepted, so there is nothing to cancel.",
  in_progress:
    "This service has already started, so it can no longer be cancelled here. Please speak to the provider directly.",
  unknown_status:
    "This booking cannot be cancelled from here. Please contact the provider directly.",
};

/** The canonical value REGO writes for a cancelled booking. */
export const CANCELLED_STATUS = "cancelled";

/* ------------------------------------------------------------------ */
/* Reasons                                                             */
/* ------------------------------------------------------------------ */

export const CANCEL_REASONS = [
  { value: "plan_change", label: "Change of travel plan" },
  { value: "found_another", label: "Found another option" },
  { value: "date_issue", label: "Date or time issue" },
  { value: "price_issue", label: "Price issue" },
  { value: "provider_issue", label: "Provider-related issue" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
] as const;

export type CancelReasonValue = (typeof CANCEL_REASONS)[number]["value"];

export function isCancelReason(v: string): v is CancelReasonValue {
  return CANCEL_REASONS.some((r) => r.value === v);
}

export function reasonLabel(v: string): string {
  return CANCEL_REASONS.find((r) => r.value === v)?.label ?? v;
}

/** Free text is capped so a note cannot be used to store something large. */
export const MAX_NOTE = 500;
export const MAX_CUSTOM_REASON = 200;

/* ------------------------------------------------------------------ */
/* Display                                                             */
/* ------------------------------------------------------------------ */

export interface StatusMeta {
  label: string;
  /** Tailwind classes, matching what the dashboards already use. */
  cls: string;
}

/**
 * One place that turns a status into a label.
 *
 * Written because every dashboard had its own chain of ternaries ending in
 * "Pending" — so a booking cancelled by a traveller would have displayed to
 * its provider as still waiting for their answer.
 */
export function bookingStatusMeta(status: string | null | undefined): StatusMeta {
  const s = (status ?? "").trim().toLowerCase();
  switch (s) {
    case "accepted":
    case "approved":
    case "confirmed":
      return { label: "Confirmed", cls: "bg-forest-50 text-forest-600" };
    case "completed":
      return { label: "Completed", cls: "bg-emerald-50 text-emerald-700" };
    case "cancelled":
    case "canceled":
      return { label: "Cancelled", cls: "bg-slate-100 text-slate-600" };
    case "rejected":
    case "declined":
      return { label: "Rejected", cls: "bg-red-50 text-red-600" };
    case "in_progress":
    case "started":
      return { label: "In progress", cls: "bg-sky-50 text-sky-700" };
    default:
      return { label: "Pending", cls: "bg-gold/20 text-gold-700" };
  }
}

/** Who cancelled, as a sentence. Older rows have no cancelled_by at all. */
export function cancelledByLabel(by: string | null | undefined): string {
  switch ((by ?? "").trim().toLowerCase()) {
    case "traveler":
    case "traveller":
      return "Cancelled by traveller";
    case "provider":
    case "owner":
      return "Cancelled by provider";
    case "admin":
      return "Cancelled by Rego";
    default:
      return "Cancelled";
  }
}

/** The value written for a traveller-initiated cancellation. */
export const CANCELLED_BY_TRAVELER = "traveler";

/**
 * The wording shown above the confirm button.
 *
 * Kept here, next to the rules, rather than inside the modal: it is a
 * statement about how REGO handles money and it should be edited in the
 * same breath as the logic it describes.
 */
export const CANCELLATION_POLICY_NOTICE =
  "Please review the cancellation policy before cancelling. Any advance payment or refund will be handled directly between the traveller and service provider according to their agreed payment terms. Rego does not currently process or hold booking payments.";
