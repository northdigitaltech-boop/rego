/* ============================================================
 * The booking state machine.
 *
 * Pure, and deliberately strict: an illegal transition throws
 * rather than being tolerated. A flight order that slid sideways
 * into the wrong state is money in the wrong place, and the point
 * of failure should be the line that tried it, not a support
 * ticket three days later.
 *
 * INTERNAL STATE IS NOT PROVIDER STATE
 *   They are separate columns because they genuinely disagree. The
 *   case that matters: payment taken, provider booking failed.
 *   REGO is `booking_failed` and owes a refund; the provider has
 *   no record at all. Merging the two loses exactly the situation
 *   that costs the most.
 * ============================================================ */

import type { FlightOrderState } from "./types";

/**
 * Legal moves. Anything not listed is illegal — including staying put,
 * which callers should not need to ask for.
 *
 * Read this as the happy path with escape hatches, not as a graph to explore:
 *
 *   draft → search_selected → price_confirmed → payment_pending
 *     → payment_success → booking_pending → booked
 *     → ticketing_pending → ticketed
 */
const TRANSITIONS: Record<FlightOrderState, readonly FlightOrderState[]> = {
  draft: ["search_selected"],

  /* Back to draft is allowed: the customer changed their mind at the results
     page, which is not a failure and should not need a new order. */
  search_selected: ["price_confirmed", "draft", "booking_failed"],

  /* Reprice can send them back — the fare moved and they must re-agree. */
  price_confirmed: ["payment_pending", "search_selected", "booking_failed"],

  payment_pending: ["payment_success", "booking_failed"],

  payment_success: ["booking_pending", "booking_failed"],

  /* A timeout here does NOT go straight to failed. The booking may exist;
     retrieveBooking decides, and only then does the state move. */
  booking_pending: ["booked", "booking_failed"],

  booked: ["ticketing_pending", "cancel_requested", "booking_failed"],

  ticketing_pending: ["ticketed", "ticketing_failed"],

  /* The end of the happy path. Everything after is cancellation or refund. */
  ticketed: ["cancel_requested", "refund_requested"],

  /* Money was taken and there is no booking. The only way out is a refund. */
  booking_failed: ["refund_requested", "cancelled"],

  /* A PNR exists but no ticket. Admin either retries ticketing or cancels
     and refunds — and retrying is manual, because an automatic retry against
     ticketing can double-issue. */
  ticketing_failed: ["ticketing_pending", "cancel_requested", "refund_requested"],

  cancel_requested: ["cancelled", "booked", "ticketed"],

  cancelled: ["refund_requested"],

  refund_requested: ["refund_pending", "refunded", "partially_refunded"],

  refund_pending: ["refunded", "partially_refunded"],

  /* Terminal. */
  refunded: [],
  partially_refunded: [],
};

/** States nothing can leave. */
export const TERMINAL_STATES: readonly FlightOrderState[] = [
  "refunded",
  "partially_refunded",
];

/**
 * States where REGO holds the customer's money but owes them something.
 *
 * Exists so the admin dashboard can surface them without re-deriving the list
 * — these are the orders that must never sit unattended.
 */
export const OWES_CUSTOMER_STATES: readonly FlightOrderState[] = [
  "booking_failed",
  "ticketing_failed",
  "refund_requested",
  "refund_pending",
];

export function canTransition(
  from: FlightOrderState,
  to: FlightOrderState
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(
  from: FlightOrderState
): readonly FlightOrderState[] {
  return TRANSITIONS[from];
}

export function isTerminal(state: FlightOrderState): boolean {
  return TERMINAL_STATES.includes(state);
}

export class IllegalTransitionError extends Error {
  readonly from: FlightOrderState;
  readonly to: FlightOrderState;

  constructor(from: FlightOrderState, to: FlightOrderState) {
    super(
      `Illegal flight order transition ${from} → ${to}. ` +
        `Allowed from ${from}: ${TRANSITIONS[from].join(", ") || "(terminal)"}.`
    );
    this.name = "IllegalTransitionError";
    this.from = from;
    this.to = to;
  }
}

/**
 * Assert a move is legal. Throws if it is not.
 *
 * Call this before writing the new state, never after. The throw is the
 * feature: a bad transition should stop the request, not be logged and
 * shrugged at.
 */
export function assertTransition(
  from: FlightOrderState,
  to: FlightOrderState
): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

/* ------------------------------------------------------------------ */
/* Display                                                             */
/* ------------------------------------------------------------------ */

/** Customer-facing wording. Deliberately plain — no jargon, no false calm. */
export const STATE_LABELS: Record<FlightOrderState, string> = {
  draft: "Not started",
  search_selected: "Flight selected",
  price_confirmed: "Price confirmed",
  payment_pending: "Awaiting payment",
  payment_success: "Payment received",
  booking_pending: "Booking with the airline",
  booked: "Booked — ticket pending",
  ticketing_pending: "Issuing ticket",
  ticketed: "Ticket issued",
  booking_failed: "Booking failed",
  ticketing_failed: "Ticket could not be issued",
  cancel_requested: "Cancellation requested",
  cancelled: "Cancelled",
  refund_requested: "Refund requested",
  refund_pending: "Refund in progress",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

/**
 * Whether a state is good, in-progress or bad — for badge colour only.
 *
 * `booked` is "pending", not "good": a booking without a ticket is not a
 * flight anybody can board, and colouring it green would tell the customer
 * something untrue.
 */
export function stateTone(
  state: FlightOrderState
): "good" | "pending" | "bad" {
  switch (state) {
    case "ticketed":
    case "refunded":
      return "good";
    case "booking_failed":
    case "ticketing_failed":
    case "cancelled":
      return "bad";
    default:
      return "pending";
  }
}
