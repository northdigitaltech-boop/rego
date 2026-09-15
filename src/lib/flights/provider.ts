/* ============================================================
 * The FlightProvider boundary.
 *
 * Everything above this line speaks REGO's normalized types
 * (./types.ts). Everything below it is one vendor's idea of what a
 * flight looks like. An adapter's only job is translation.
 *
 * WHY THE INTERFACE IS THIS WIDE
 *   Booking a flight is not one call. Search, price, book, pay,
 *   ticket, retrieve, cancel and refund are separate operations
 *   with separate failure modes, and a provider can succeed at one
 *   and fail at the next. Collapsing them into "book()" would hide
 *   exactly the states that cost money — booked-but-not-ticketed
 *   above all.
 *
 * WHY EVERY METHOD TAKES A ProviderContext
 *   Correlation id, idempotency key and an abort signal are not
 *   optional extras on a flight call. Without the first, a failure
 *   cannot be traced across search → book → ticket. Without the
 *   second, a retry books twice. Without the third, a slow GDS
 *   holds a serverless function until it times out.
 * ============================================================ */

import type {
  Airline,
  Airport,
  CabinClass,
  ContactDetails,
  FlightOffer,
  FlightPassenger,
  FlightProviderId,
  FlightRefund,
  FlightSearchRequest,
  FlightTicket,
  Money,
} from "./types";

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface ProviderContext {
  /** Follows one customer journey across every provider call. */
  correlationId: string;
  /**
   * Set on mutating calls only. The adapter passes it to the provider where
   * the provider supports one, and REGO enforces it in the database
   * regardless — flight_orders.idempotency_key is UNIQUE.
   */
  idempotencyKey?: string;
  /** Flight APIs are slow. Every call must be abortable. */
  signal?: AbortSignal;
  /** Milliseconds. Adapters must honour this, not just pass it along. */
  timeoutMs?: number;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/**
 * Why a provider call failed, in terms REGO can act on.
 *
 * `retryable` is the field that matters. A booking timeout is NOT retryable —
 * the booking may well have succeeded, and the correct response is to
 * retrieve, not to try again. Getting this wrong is how duplicate PNRs and
 * double charges happen.
 */
export type FlightProviderErrorKind =
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "offer_expired"
  | "price_changed"
  | "seat_unavailable"
  | "invalid_passenger"
  | "payment_declined"
  | "booking_failed"
  | "ticketing_failed"
  | "not_found"
  | "provider_unavailable"
  | "unknown";

export class FlightProviderError extends Error {
  readonly kind: FlightProviderErrorKind;
  readonly providerId: FlightProviderId;
  /** The provider's own code, for support to quote back to them. */
  readonly providerCode: string | null;
  readonly retryable: boolean;
  readonly correlationId: string | null;

  constructor(input: {
    kind: FlightProviderErrorKind;
    providerId: FlightProviderId;
    message: string;
    providerCode?: string | null;
    retryable?: boolean;
    correlationId?: string | null;
  }) {
    super(input.message);
    this.name = "FlightProviderError";
    this.kind = input.kind;
    this.providerId = input.providerId;
    this.providerCode = input.providerCode ?? null;
    this.correlationId = input.correlationId ?? null;
    this.retryable =
      input.retryable ??
      /* Safe default: only read-side failures retry on their own. Anything
         that might have created a booking does not. */
      (input.kind === "rate_limited" || input.kind === "provider_unavailable");
  }
}

/* ------------------------------------------------------------------ */
/* Call inputs & results                                               */
/* ------------------------------------------------------------------ */

export interface CreateBookingInput {
  offerId: string;
  providerOfferId: string;
  passengers: FlightPassenger[];
  contact: ContactDetails;
}

export interface ProviderBooking {
  providerBookingRef: string;
  pnr: string | null;
  /** The provider's own status string. Stored, never merged with ours. */
  providerState: string;
  /** Some providers hold a booking only until this moment. */
  ticketingDeadline: string | null;
}

export interface AddPaymentInput {
  providerBookingRef: string;
  amount: Money;
  /**
   * A token from the payment gateway. NEVER a card number.
   * Nothing downstream of this may log it.
   */
  paymentToken: string;
}

export interface ProviderPaymentResult {
  accepted: boolean;
  providerPaymentRef: string | null;
}

export interface IssueTicketInput {
  providerBookingRef: string;
}

export interface ProviderCancellation {
  cancelled: boolean;
  providerState: string;
  penalty: Money | null;
  refundableAmount: Money | null;
}

export interface RefundInput {
  providerBookingRef: string;
  ticketNumbers: string[];
  amount: Money | null;
}

export interface ExchangeInput {
  providerBookingRef: string;
  newOfferId: string;
}

export interface SeatMap {
  segmentId: string;
  rows: SeatRow[];
}

export interface SeatRow {
  rowNumber: number;
  seats: {
    designator: string;
    available: boolean;
    price: Money | null;
    characteristics: string[];
  }[];
}

export interface Ancillary {
  id: string;
  kind: "bag" | "seat" | "meal" | "lounge" | "insurance" | "other";
  description: string;
  price: Money;
  segmentId: string | null;
  passengerId: string | null;
}

/* ------------------------------------------------------------------ */
/* The interface                                                       */
/* ------------------------------------------------------------------ */

export interface FlightProvider {
  readonly id: FlightProviderId;
  /** Human label for admin screens and logs. */
  readonly label: string;
  /** False until credentials and accreditation exist. Checked before use. */
  readonly isConfigured: boolean;

  searchFlights(
    request: FlightSearchRequest,
    ctx: ProviderContext
  ): Promise<FlightOffer[]>;

  /**
   * Revalidate a selected offer.
   *
   * MANDATORY before payment, without exception. The search price is an
   * indication; this is the number the airline will actually honour. If it
   * differs, the customer must see both and agree before anything is charged.
   */
  priceOffer(
    providerOfferId: string,
    ctx: ProviderContext
  ): Promise<FlightOffer>;

  createBooking(
    input: CreateBookingInput,
    ctx: ProviderContext
  ): Promise<ProviderBooking>;

  addPayment(
    input: AddPaymentInput,
    ctx: ProviderContext
  ): Promise<ProviderPaymentResult>;

  /** The step that spends real money. Never called speculatively. */
  issueTicket(
    input: IssueTicketInput,
    ctx: ProviderContext
  ): Promise<FlightTicket[]>;

  /**
   * Read a booking back.
   *
   * This is the answer to a timeout on createBooking — ask what actually
   * happened rather than trying again and risking a second PNR.
   */
  retrieveBooking(
    providerBookingRef: string,
    ctx: ProviderContext
  ): Promise<ProviderBooking>;

  cancelBooking(
    providerBookingRef: string,
    ctx: ProviderContext
  ): Promise<ProviderCancellation>;

  refundBooking(input: RefundInput, ctx: ProviderContext): Promise<FlightRefund>;

  exchangeBooking(
    input: ExchangeInput,
    ctx: ProviderContext
  ): Promise<ProviderBooking>;

  /** Null when the provider has no seat map for this offer. Not an error. */
  getSeatMap(
    providerOfferId: string,
    ctx: ProviderContext
  ): Promise<SeatMap | null>;

  getAncillaries(
    providerOfferId: string,
    ctx: ProviderContext
  ): Promise<Ancillary[]>;
}

/* ------------------------------------------------------------------ */
/* Reference data lookups                                              */
/* ------------------------------------------------------------------ */

/**
 * Airport and airline lookups are deliberately NOT on FlightProvider.
 *
 * They are REGO's own reference data, in REGO's own tables, and autocomplete
 * must answer in tens of milliseconds. Routing it through a GDS would make
 * typing a city name as slow as a flight search.
 */
export interface FlightReferenceData {
  searchAirports(query: string, limit?: number): Promise<Airport[]>;
  getAirport(iataCode: string): Promise<Airport | null>;
  getAirline(iataCode: string): Promise<Airline | null>;
}

/** Cabins in the order a UI should offer them. */
export const CABIN_CLASSES: readonly CabinClass[] = [
  "economy",
  "premium_economy",
  "business",
  "first",
] as const;

export const CABIN_LABELS: Record<CabinClass, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First",
};
