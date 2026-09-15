/* ============================================================
 * REGO Flights — normalized domain models.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 *   Nothing in here may reference a provider's shape. Not
 *   Travelport, not Amadeus, not Duffel. Adapters map provider
 *   payloads INTO these types, and the rest of REGO only ever sees
 *   these types.
 *
 *   The moment a Travelport field name leaks into a component or a
 *   route, changing provider stops being a config change and
 *   becomes a rewrite. That leak is quiet and it is permanent, so
 *   it is worth guarding here rather than discovering later.
 *
 * MONEY IS NEVER A NUMBER OF RUPEES
 *   Every amount is minor units (paisa, cents) as an integer, with
 *   an ISO-4217 code beside it. Floats and money do not mix: three
 *   passengers, two segments and a percentage markup is enough
 *   arithmetic for a float to land a rupee off, and a rupee off on
 *   a payment page is a support ticket.
 * ============================================================ */

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export interface Money {
  /** Minor units. PKR 8,500.00 is 850000. Always an integer. */
  amount: number;
  /** ISO-4217, uppercase. "PKR", "USD". */
  currency: string;
}

export const zeroMoney = (currency: string): Money => ({ amount: 0, currency });

/**
 * Add amounts that share a currency.
 *
 * Throws on a mismatch rather than coercing. A silent currency mix is the
 * kind of bug that produces a plausible-looking total nobody can reproduce.
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(
      `Cannot add ${a.currency} to ${b.currency} — convert first, deliberately.`
    );
  }
  return { amount: a.amount + b.amount, currency: a.currency };
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export type TripType = "one_way" | "round_trip" | "multi_city";

export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export interface FlightSearchLeg {
  /** IATA code, uppercase. Validated before it reaches a provider. */
  origin: string;
  destination: string;
  /** ISO date, no time. The airline's local date, not the user's. */
  departureDate: string;
}

export interface PassengerCounts {
  adults: number;
  /** 2–11 at the time of travel. */
  children: number;
  /** Under 2, on an adult's lap. Cannot exceed adults. */
  infants: number;
}

export interface FlightSearchRequest {
  tripType: TripType;
  /** One leg for one-way, two for round trip, 2–6 for multi-city. */
  legs: FlightSearchLeg[];
  passengers: PassengerCounts;
  cabin: CabinClass;
  /** ISO-4217 the customer wants to see. Display only — see §Money. */
  currency: string;
  /** Optional filters a provider can apply server-side rather than us. */
  directOnly?: boolean;
  preferredAirlines?: string[];
  maxStops?: number;
}

/* ------------------------------------------------------------------ */
/* Itinerary                                                           */
/* ------------------------------------------------------------------ */

export interface FlightSegment {
  id: string;
  /** Marketing carrier — the code on the ticket. */
  carrierCode: string;
  carrierName: string;
  /** Set when someone else actually flies it. Passengers care about this. */
  operatingCarrierCode: string | null;
  operatingCarrierName: string | null;
  flightNumber: string;

  originCode: string;
  originName: string | null;
  originTerminal: string | null;
  /** ISO-8601 WITH offset. A departure time without one is unreadable. */
  departureAt: string;

  destinationCode: string;
  destinationName: string | null;
  destinationTerminal: string | null;
  arrivalAt: string;

  /** Minutes in the air for this segment. */
  durationMinutes: number;
  aircraftCode: string | null;
  aircraftName: string | null;
  cabin: CabinClass;
  /** Airline's own booking class letter, when the provider gives one. */
  bookingClass: string | null;
}

export interface FlightLayover {
  airportCode: string;
  airportName: string | null;
  durationMinutes: number;
  /** True when the stop crosses airports — a real risk the UI must show. */
  changeOfAirport: boolean;
  /** True when the passenger must clear immigration and re-check bags. */
  requiresRecheck: boolean | null;
}

export interface FlightItinerary {
  id: string;
  segments: FlightSegment[];
  layovers: FlightLayover[];
  /** Gate to gate, including layovers. */
  totalDurationMinutes: number;
  stopCount: number;
}

/* ------------------------------------------------------------------ */
/* Baggage & fare conditions                                           */
/* ------------------------------------------------------------------ */

export interface FlightBaggage {
  /** Airlines quote either pieces or weight. Whichever the fare uses. */
  checkedPieces: number | null;
  checkedWeightKg: number | null;
  cabinPieces: number | null;
  cabinWeightKg: number | null;
  /** Verbatim from the provider when it does not fit the fields above. */
  note: string | null;
}

export interface FareConditions {
  refundable: boolean;
  changeable: boolean;
  /** Null means the provider did not say — which is NOT the same as free. */
  refundPenalty: Money | null;
  changePenalty: Money | null;
  /** Fare basis / family, e.g. "ECOFLEX". Shown as-is. */
  fareFamily: string | null;
  fareBasisCode: string | null;
  /** Unparsed rule text. Displayed, never interpreted by REGO. */
  rulesText: string | null;
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

/** What the provider quoted, before REGO touches it. Stored untouched. */
export interface ProviderFare {
  baseFare: Money;
  tax: Money;
  /** baseFare + tax. Kept explicit so a provider's own total can be checked. */
  total: Money;
}

/**
 * The full price breakdown, as shown and as stored.
 *
 * Provider figures and REGO's addition are separate fields on purpose: the
 * markup must never be folded into the base fare. If it is, the audit trail
 * becomes a reconstruction, and reconstructions disagree with reality exactly
 * when somebody is disputing a charge.
 */
export interface FlightFare {
  providerBaseFare: Money;
  providerTax: Money;
  regoMarkup: Money;
  regoServiceFee: Money;
  /** provider + markup + fee. What the customer pays. */
  customerTotal: Money;
  /** Every rule that MATCHED, including ones that lost on priority. */
  markupRuleIds: string[];
  conditions: FareConditions;
  baggage: FlightBaggage;
  /** Provider's own remaining-seat count. Advisory, often absent. */
  seatsRemaining: number | null;
}

/* ------------------------------------------------------------------ */
/* Offer                                                               */
/* ------------------------------------------------------------------ */

export interface FlightOffer {
  /** REGO's id, not the provider's. See providerOfferId for theirs. */
  id: string;
  providerId: FlightProviderId;
  providerOfferId: string;

  /** One for one-way, two for round trip, N for multi-city. */
  itineraries: FlightItinerary[];
  fare: FlightFare;

  /** Primary marketing carrier, for the card and for filtering. */
  validatingCarrierCode: string;
  validatingCarrierName: string;
  validatingCarrierLogoUrl: string | null;

  cabin: CabinClass;
  passengers: PassengerCounts;

  /**
   * When this price stops being real.
   *
   * Not decoration: the UI must refuse to carry an expired offer into
   * checkout, and reprice is mandatory regardless of this value.
   */
  expiresAt: string;

  /**
   * True for anything the MockFlightProvider produced.
   *
   * Surfaced as a visible badge outside production. A screenshot of a mock
   * result must never be mistakable for a real ticket.
   */
  isMock: boolean;
}

/* ------------------------------------------------------------------ */
/* Passengers                                                          */
/* ------------------------------------------------------------------ */

export type PassengerType = "adult" | "child" | "infant";

export type PassengerTitle = "mr" | "mrs" | "ms" | "miss" | "mstr";

export type Gender = "male" | "female" | "unspecified";

/**
 * Passport fields are OPTIONAL here on purpose.
 *
 * They are collected only when the itinerary requires them, and retention is
 * deliberately short — see docs/FLIGHTS_ARCHITECTURE.md §10. Nothing in this
 * codebase may log `passportNumber`, put it in a PDF stored at rest, or select
 * it in a list query.
 */
export interface FlightPassenger {
  id: string;
  type: PassengerType;
  title: PassengerTitle;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: Gender | null;
  /** ISO date. Required — fare and baggage depend on age at travel. */
  dateOfBirth: string;
  /** ISO-3166 alpha-2. */
  nationality: string | null;

  passportNumber?: string | null;
  passportExpiry?: string | null;
  passportIssuingCountry?: string | null;

  frequentFlyerCarrier?: string | null;
  frequentFlyerNumber?: string | null;

  /** Infants travel on an adult's ticket; this links them. */
  associatedAdultId?: string | null;
}

export interface ContactDetails {
  email: string;
  /** E.164 where possible. Kept separate from the dial code for the UI. */
  phone: string;
  phoneCountryCode: string;
}

/* ------------------------------------------------------------------ */
/* Orders, tickets, payments, refunds                                  */
/* ------------------------------------------------------------------ */

export type FlightOrderState =
  | "draft"
  | "search_selected"
  | "price_confirmed"
  | "payment_pending"
  | "payment_success"
  | "booking_pending"
  | "booked"
  | "ticketing_pending"
  | "ticketed"
  | "booking_failed"
  | "ticketing_failed"
  | "cancel_requested"
  | "cancelled"
  | "refund_requested"
  | "refund_pending"
  | "refunded"
  | "partially_refunded";

export interface FlightOrder {
  id: string;
  userId: string | null;
  state: FlightOrderState;

  /** Whatever the provider calls its own booking status. Never merged. */
  providerState: string | null;
  providerId: FlightProviderId;
  providerBookingRef: string | null;
  /** The PNR a customer quotes at an airport. */
  pnr: string | null;

  /** UNIQUE in the database. This is what stops a refresh double-booking. */
  idempotencyKey: string;
  correlationId: string;

  itineraries: FlightItinerary[];
  fare: FlightFare;
  passengers: FlightPassenger[];
  contact: ContactDetails;

  createdAt: string;
  updatedAt: string;
}

export interface FlightTicket {
  id: string;
  orderId: string;
  passengerId: string;
  /** 13-digit airline ticket number. */
  ticketNumber: string;
  issuedAt: string;
  status: "issued" | "void" | "refunded" | "exchanged";
}

export type PaymentState =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export interface FlightPayment {
  id: string;
  orderId: string;
  state: PaymentState;
  amount: Money;
  /** Gateway name. Never credentials, never card data. */
  gateway: string;
  gatewayReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlightRefund {
  id: string;
  orderId: string;
  requestedAmount: Money;
  approvedAmount: Money | null;
  /** The airline's penalty, kept apart from what REGO returns. */
  providerPenalty: Money | null;
  state: "requested" | "pending" | "completed" | "rejected" | "partial";
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export interface Airport {
  id: string;
  iataCode: string;
  icaoCode: string | null;
  airportName: string;
  city: string;
  country: string;
  countryCode: string;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
}

export interface Airline {
  id: string;
  iataCode: string;
  icaoCode: string | null;
  name: string;
  logoUrl: string | null;
  countryCode: string | null;
  isActive: boolean;
}

/* ------------------------------------------------------------------ */
/* Provider identity                                                   */
/* ------------------------------------------------------------------ */

export type FlightProviderId =
  | "mock"
  | "travelport"
  | "amadeus"
  | "duffel"
  | "sabre";
