/* ============================================================
 * MockFlightProvider.
 *
 * Exists so the entire booking UI can be built and tested before
 * anyone has Travelport credentials — and so the failure paths
 * can be exercised deliberately rather than discovered in
 * production.
 *
 * TWO GUARDS THAT MUST NOT BE REMOVED
 *   1. Every offer carries isMock: true. The UI badges it. A
 *      screenshot of a mock result must never be mistakable for a
 *      real ticket.
 *   2. issueTicket() THROWS unless FLIGHT_ALLOW_MOCK_TICKETING is
 *      explicitly "true". A fake 13-digit ticket number reaching a
 *      customer is worse than having no flights module at all —
 *      they would arrive at an airport with nothing.
 *
 * DETERMINISM
 *   Results are seeded from the search parameters, so the same
 *   search returns the same flights. Tests need that, and so does
 *   anyone demoing the same screen twice.
 * ============================================================ */

import {
  FlightProviderError,
  type AddPaymentInput,
  type Ancillary,
  type CreateBookingInput,
  type ExchangeInput,
  type FlightProvider,
  type IssueTicketInput,
  type ProviderBooking,
  type ProviderCancellation,
  type ProviderContext,
  type ProviderPaymentResult,
  type RefundInput,
  type SeatMap,
} from "../../provider";
import type {
  CabinClass,
  FlightFare,
  FlightItinerary,
  FlightLayover,
  FlightOffer,
  FlightRefund,
  FlightSearchRequest,
  FlightSegment,
  FlightTicket,
  Money,
  PassengerCounts,
} from "../../types";
import {
  CABIN_MULTIPLIER,
  MOCK_AIRLINES,
  MOCK_AIRPORTS,
  MOCK_BASE_FARE_PKR,
  MOCK_FARE_FAMILIES,
  MOCK_HOPS,
  type MockHop,
} from "./fixtures";

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-randomness                                     */
/* ------------------------------------------------------------------ */

/** FNV-1a. Small, dependency-free, good enough to seed a demo. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seeded(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

/* ------------------------------------------------------------------ */
/* Route building                                                      */
/* ------------------------------------------------------------------ */

const hopsFrom = (from: string): MockHop[] =>
  MOCK_HOPS.filter((h) => h.from === from);

/**
 * Every path from origin to destination up to `maxStops`, breadth-first.
 *
 * Real inventory is not a graph search, but the shapes it produces —
 * direct, one-stop, two-stop — are what the results UI has to render, and
 * composing them beats hand-writing every itinerary.
 */
function findRoutes(origin: string, destination: string, maxStops: number): MockHop[][] {
  const out: MockHop[][] = [];
  const walk = (at: string, path: MockHop[], visited: Set<string>) => {
    if (path.length > maxStops + 1) return;
    for (const hop of hopsFrom(at)) {
      if (visited.has(hop.to)) continue;
      const next = [...path, hop];
      if (hop.to === destination) {
        out.push(next);
        continue;
      }
      walk(hop.to, next, new Set([...visited, hop.to]));
    }
  };
  walk(origin, [], new Set([origin]));
  /* Fewest stops first — the order a results page defaults to. */
  return out.sort((a, b) => a.length - b.length).slice(0, 8);
}

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
 * Times are carried as a UTC INSTANT (milliseconds) and only turned into
 * a string at the last moment, with the offset of the airport it belongs to.
 *
 * The first version of this formatted departures correctly and then built
 * arrivals with `new Date(...).toISOString()` — which always returns UTC. So
 * ISB→DXB showed "departs 04:25, arrives 02:20, 2h 55m": the departure in
 * Islamabad time, the arrival in UTC, and a duration that matched neither.
 *
 * Every timestamp now goes through isoAt() with an explicit offset. There is
 * no path that produces a bare Z string.
 * ------------------------------------------------------------------ */

/** Local clock time at an airport, as an ISO string carrying its offset. */
function isoAt(instantMs: number, offsetMinutes: number): string {
  const local = new Date(instantMs + offsetMinutes * 60_000);

  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");

  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  const h = String(local.getUTCHours()).padStart(2, "0");
  const mi = String(local.getUTCMinutes()).padStart(2, "0");

  return `${y}-${mo}-${d}T${h}:${mi}:00${sign}${oh}:${om}`;
}

/** The UTC instant of a local departure time on a given date. */
function instantOf(dateIso: string, minuteOfDay: number, offsetMinutes: number): number {
  return Date.parse(`${dateIso}T00:00:00Z`) + (minuteOfDay - offsetMinutes) * 60_000;
}

/* ------------------------------------------------------------------ */
/* Fare building                                                       */
/* ------------------------------------------------------------------ */

function hopFare(hop: MockHop): number {
  return MOCK_BASE_FARE_PKR[`${hop.from}-${hop.to}`] ?? 5_000_000;
}

function passengerUnits(p: PassengerCounts): number {
  /* Child ~75%, infant ~10%. Conventional, and enough for the UI to be
     exercised with mixed party sizes. */
  return p.adults + p.children * 0.75 + p.infants * 0.1;
}

/* ------------------------------------------------------------------ */
/* The provider                                                        */
/* ------------------------------------------------------------------ */

const PROVIDER_ID = "mock" as const;

function mockTicketingAllowed(): boolean {
  return process.env.FLIGHT_ALLOW_MOCK_TICKETING === "true";
}

export class MockFlightProvider implements FlightProvider {
  readonly id = PROVIDER_ID;
  readonly label = "Mock (development)";
  readonly isConfigured = true;

  async searchFlights(
    request: FlightSearchRequest,
    ctx: ProviderContext
  ): Promise<FlightOffer[]> {
    const leg = request.legs[0];
    if (!leg) {
      throw new FlightProviderError({
        kind: "unknown",
        providerId: PROVIDER_ID,
        message: "A search needs at least one leg.",
        correlationId: ctx.correlationId,
      });
    }

    const origin = leg.origin.toUpperCase();
    const destination = leg.destination.toUpperCase();

    if (!MOCK_AIRPORTS[origin] || !MOCK_AIRPORTS[destination]) {
      /* Honest empty result rather than invented inventory for an airport the
         fixtures have never heard of. */
      return [];
    }

    await this.simulateLatency(ctx, 350, 900);

    const routes = findRoutes(origin, destination, request.maxStops ?? 2);
    const rand = seeded(
      hashString(`${origin}${destination}${leg.departureDate}${request.cabin}`)
    );

    /* The return leg. A round trip arrives as two legs; the second is the way
       home, and an offer must carry both or the customer is shown half of
       what they asked for. */
    const returnLeg = request.tripType === "round_trip" ? request.legs[1] : null;
    const returnRoutes = returnLeg
      ? findRoutes(
          returnLeg.origin.toUpperCase(),
          returnLeg.destination.toUpperCase(),
          request.maxStops ?? 2
        )
      : [];

    if (returnLeg && returnRoutes.length === 0) {
      /* Nothing flies back in the fixtures. Returning outbound-only offers
         would be worse than returning none: the customer would book a flight
         home that does not exist. */
      return [];
    }

    const offers: FlightOffer[] = [];

    for (const route of routes) {
      for (const family of MOCK_FARE_FAMILIES) {
        /* Not every fare family exists on every route — thinning this keeps
           the results list from looking machine-generated. */
        if (route.length > 1 && family.code === "ECOLITE" && rand() > 0.5) continue;

        /* Pair each outbound with one return rather than every combination:
           N×M offers is how a results page becomes unreadable. Real inventory
           is priced as a round trip, not as a cartesian product. */
        const returnRoute = returnLeg
          ? returnRoutes[Math.min(routes.indexOf(route), returnRoutes.length - 1)]
          : null;

        const offer = this.buildOffer({
          route,
          returnRoute,
          family,
          request,
          rand,
          departureDate: leg.departureDate,
          returnDate: returnLeg?.departureDate ?? null,
        });
        offers.push(offer);
      }
    }

    return offers.sort(
      (a, b) => a.fare.customerTotal.amount - b.fare.customerTotal.amount
    );
  }

  /** One leg → one itinerary. Times computed as instants, formatted locally. */
  private buildItinerary(input: {
    route: MockHop[];
    cabin: CabinClass;
    departureDate: string;
    rand: () => number;
    keySuffix: string;
  }): FlightItinerary {
    const { route, cabin, departureDate, rand, keySuffix } = input;

    const segments: FlightSegment[] = [];
    const layovers: FlightLayover[] = [];
    let cursorMs = 0;

    route.forEach((hop, i) => {
      const originAirport = MOCK_AIRPORTS[hop.from];
      const destAirport = MOCK_AIRPORTS[hop.to];

      const departMs =
        i === 0
          ? instantOf(departureDate, hop.departMinuteOfDay, originAirport.utcOffsetMinutes)
          : /* Connect 75–240 minutes after the previous arrival. */
            cursorMs + (75 + Math.floor(rand() * 165)) * 60_000;

      const arriveMs = departMs + hop.durationMinutes * 60_000;

      if (i > 0) {
        layovers.push({
          airportCode: hop.from,
          airportName: originAirport.name,
          durationMinutes: Math.round((departMs - cursorMs) / 60_000),
          changeOfAirport: false,
          requiresRecheck:
            originAirport.countryCode !== destAirport.countryCode ? null : false,
        });
      }

      segments.push({
        id: `mock-seg-${hop.carrier}${hop.flightNumber}-${keySuffix}-${i}`,
        carrierCode: hop.carrier,
        carrierName: MOCK_AIRLINES[hop.carrier]?.name ?? hop.carrier,
        operatingCarrierCode: null,
        operatingCarrierName: null,
        flightNumber: hop.flightNumber,
        originCode: hop.from,
        originName: originAirport.name,
        originTerminal: null,
        /* Each end formatted with ITS OWN airport's offset. */
        departureAt: isoAt(departMs, originAirport.utcOffsetMinutes),
        destinationCode: hop.to,
        destinationName: destAirport.name,
        destinationTerminal: null,
        arrivalAt: isoAt(arriveMs, destAirport.utcOffsetMinutes),
        durationMinutes: hop.durationMinutes,
        aircraftCode: hop.aircraft,
        aircraftName: hop.aircraftName,
        cabin,
        bookingClass: null,
      });

      cursorMs = arriveMs;
    });

    /* Elapsed time from the first departure instant to the last arrival
       instant — not a subtraction of two local clock strings, which would be
       wrong by the difference between the two time zones. */
    const firstDepartMs = instantOf(
      departureDate,
      route[0].departMinuteOfDay,
      MOCK_AIRPORTS[route[0].from].utcOffsetMinutes
    );

    return {
      id: `mock-itin-${keySuffix}-${segments.map((s) => s.id).join("_")}`,
      segments,
      layovers,
      totalDurationMinutes: Math.round((cursorMs - firstDepartMs) / 60_000),
      stopCount: segments.length - 1,
    };
  }

  private buildOffer(input: {
    route: MockHop[];
    returnRoute: MockHop[] | null;
    family: (typeof MOCK_FARE_FAMILIES)[number];
    request: FlightSearchRequest;
    rand: () => number;
    departureDate: string;
    returnDate: string | null;
  }): FlightOffer {
    const { route, returnRoute, family, request, rand, departureDate, returnDate } = input;
    const cabin: CabinClass = request.cabin;

    const itineraries: FlightItinerary[] = [
      this.buildItinerary({ route, cabin, departureDate, rand, keySuffix: "out" }),
    ];

    /* The return leg. Its absence was a real bug: a round-trip search came
       back showing only the outbound, with no indication the return had been
       dropped — the worst kind, because the result looks complete. */
    if (returnRoute && returnDate) {
      itineraries.push(
        this.buildItinerary({
          route: returnRoute,
          cabin,
          departureDate: returnDate,
          rand,
          keySuffix: "ret",
        })
      );
    }

    const segments = itineraries[0].segments;

    /* Fare: sum the hops on every leg, apply cabin and family, scale by party. */
    const allHops = returnRoute ? [...route, ...returnRoute] : route;
    const hopTotal = allHops.reduce((sum, h) => sum + hopFare(h), 0);
    const perUnit = hopTotal * CABIN_MULTIPLIER[cabin] * family.multiplier;
    const units = passengerUnits(request.passengers);
    const baseAmount = Math.round(perUnit * units);
    /* Tax roughly 18% of base — plausible shape, not a real tax table. */
    const taxAmount = Math.round(baseAmount * 0.18);

    const currency = "PKR";
    const baseFare: Money = { amount: baseAmount, currency };
    const tax: Money = { amount: taxAmount, currency };

    /* NOTE: markup is NOT applied here. A provider returns provider figures;
       REGO's markup engine adds its own on top, in the service layer. The
       mock must not pretend to be REGO. */
    const fare: FlightFare = {
      providerBaseFare: baseFare,
      providerTax: tax,
      regoMarkup: { amount: 0, currency },
      regoServiceFee: { amount: 0, currency },
      customerTotal: { amount: baseAmount + taxAmount, currency },
      markupRuleIds: [],
      conditions: {
        refundable: family.refundable,
        changeable: family.changeable,
        refundPenalty: family.refundable
          ? { amount: 500_000, currency }
          : null,
        changePenalty: family.changeable ? { amount: 300_000, currency } : null,
        fareFamily: family.label,
        fareBasisCode: family.code,
        rulesText:
          "MOCK FARE RULES — not issued by any airline. For development only.",
      },
      baggage: {
        checkedPieces: family.checkedPieces,
        checkedWeightKg: family.checkedWeightKg,
        cabinPieces: 1,
        cabinWeightKg: 7,
        note: family.checkedPieces === 0 ? "Cabin bag only" : null,
      },
      seatsRemaining: 1 + Math.floor(rand() * 9),
    };

    const validating = segments[0].carrierCode;
    /* Keyed on every itinerary, so the outbound and the round trip that
       shares it are different offers rather than colliding on one id. */
    const offerKey = hashString(itineraries.map((it) => it.id).join("|") + family.code);

    return {
      id: `mock-offer-${offerKey}`,
      providerId: PROVIDER_ID,
      providerOfferId: `MOCK-${offerKey}`,
      itineraries,
      fare,
      validatingCarrierCode: validating,
      validatingCarrierName: MOCK_AIRLINES[validating]?.name ?? validating,
      validatingCarrierLogoUrl: null,
      cabin,
      passengers: request.passengers,
      /* 20 minutes, like a real held fare. Short enough that the expiry path
         gets exercised during ordinary development. */
      expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      isMock: true,
    };
  }

  async priceOffer(providerOfferId: string, ctx: ProviderContext): Promise<FlightOffer> {
    await this.simulateLatency(ctx, 250, 600);

    /* The mock cannot rebuild an offer from its id alone, and inventing a
       different itinerary here would hide the real contract: reprice is
       answered from the stored offer by the service layer, which then
       compares totals. Throwing keeps that honest. */
    throw new FlightProviderError({
      kind: "not_found",
      providerId: PROVIDER_ID,
      message:
        `Mock provider cannot reprice ${providerOfferId} in isolation. ` +
        `The service layer reprices from the stored offer.`,
      correlationId: ctx.correlationId,
      retryable: false,
    });
  }

  async createBooking(
    input: CreateBookingInput,
    ctx: ProviderContext
  ): Promise<ProviderBooking> {
    await this.simulateLatency(ctx, 400, 1200);

    const seed = hashString(input.providerOfferId + (ctx.idempotencyKey ?? ""));
    const pnr = this.makePnr(seed);

    return {
      providerBookingRef: `MOCKPNR-${pnr}`,
      pnr,
      providerState: "HELD",
      /* Three hours, so the ticketing-deadline path is testable in a sitting. */
      ticketingDeadline: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    };
  }

  async addPayment(
    input: AddPaymentInput,
    ctx: ProviderContext
  ): Promise<ProviderPaymentResult> {
    await this.simulateLatency(ctx, 200, 500);
    return {
      accepted: true,
      providerPaymentRef: `MOCKPAY-${hashString(input.providerBookingRef)}`,
    };
  }

  async issueTicket(
    input: IssueTicketInput,
    ctx: ProviderContext
  ): Promise<FlightTicket[]> {
    /* THE GUARD. A mock ticket number that reaches a customer means somebody
       arrives at an airport holding nothing. Off unless explicitly enabled. */
    if (!mockTicketingAllowed()) {
      throw new FlightProviderError({
        kind: "ticketing_failed",
        providerId: PROVIDER_ID,
        message:
          "Mock provider will not issue tickets. This is deliberate: a mock " +
          "ticket number is not a ticket. Set FLIGHT_ALLOW_MOCK_TICKETING=true " +
          "in a development environment only.",
        correlationId: ctx.correlationId,
        retryable: false,
      });
    }

    await this.simulateLatency(ctx, 500, 1500);
    const seed = hashString(input.providerBookingRef);

    return [
      {
        id: `mock-ticket-${seed}`,
        orderId: "",
        passengerId: "",
        /* Prefixed so it can never be mistaken for a real 13-digit number. */
        ticketNumber: `MOCK-${String(seed).padStart(10, "0").slice(0, 10)}`,
        issuedAt: new Date().toISOString(),
        status: "issued",
      },
    ];
  }

  async retrieveBooking(
    providerBookingRef: string,
    ctx: ProviderContext
  ): Promise<ProviderBooking> {
    await this.simulateLatency(ctx, 150, 400);
    return {
      providerBookingRef,
      pnr: providerBookingRef.replace("MOCKPNR-", ""),
      providerState: "HELD",
      ticketingDeadline: null,
    };
  }

  async cancelBooking(
    providerBookingRef: string,
    ctx: ProviderContext
  ): Promise<ProviderCancellation> {
    await this.simulateLatency(ctx, 300, 800);
    return {
      cancelled: true,
      providerState: "CANCELLED",
      penalty: { amount: 500_000, currency: "PKR" },
      refundableAmount: null,
    };
  }

  async refundBooking(input: RefundInput, ctx: ProviderContext): Promise<FlightRefund> {
    await this.simulateLatency(ctx, 300, 800);
    const now = new Date().toISOString();
    return {
      id: `mock-refund-${hashString(input.providerBookingRef)}`,
      orderId: "",
      requestedAmount: input.amount ?? { amount: 0, currency: "PKR" },
      approvedAmount: input.amount ?? null,
      providerPenalty: { amount: 500_000, currency: "PKR" },
      state: "pending",
      reason: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async exchangeBooking(
    input: ExchangeInput,
    ctx: ProviderContext
  ): Promise<ProviderBooking> {
    throw new FlightProviderError({
      kind: "unknown",
      providerId: PROVIDER_ID,
      message: `Mock provider does not support exchanges (${input.providerBookingRef}).`,
      correlationId: ctx.correlationId,
      retryable: false,
    });
  }

  async getSeatMap(): Promise<SeatMap | null> {
    /* Null is a legitimate answer, not an error — most fares have no seat map
       until after ticketing. */
    return null;
  }

  async getAncillaries(): Promise<Ancillary[]> {
    return [];
  }

  /* ---------------------------------------------------------------- */

  private makePnr(seed: number): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"; // no I or O
    const rand = seeded(seed);
    let out = "";
    for (let i = 0; i < 6; i++) {
      out += alphabet[Math.floor(rand() * alphabet.length)];
    }
    return out;
  }

  /** Real flight APIs are slow; pretending otherwise hides every loading bug. */
  private async simulateLatency(
    ctx: ProviderContext,
    minMs: number,
    maxMs: number
  ): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    const ms = minMs + Math.random() * (maxMs - minMs);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      ctx.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(
          new FlightProviderError({
            kind: "timeout",
            providerId: PROVIDER_ID,
            message: "Search aborted.",
            correlationId: ctx.correlationId,
            retryable: false,
          })
        );
      });
    });
  }
}
