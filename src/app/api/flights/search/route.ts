import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";
import { getFlightProvider, flightFlags } from "@/lib/flights/registry";
import { FlightProviderError } from "@/lib/flights/provider";
import { applyMarkup, type MarkupRule } from "@/lib/flights/markup";
import type {
  CabinClass,
  FlightOffer,
  FlightSearchRequest,
  TripType,
} from "@/lib/flights/types";

/* ============================================================
 * POST /api/flights/search
 *
 * The only way the browser reaches a flight provider. Credentials
 * stay here; this repo is public, so there is no version of this
 * that runs client-side.
 *
 * WHY MARKUP IS APPLIED HERE AND NOT IN THE PROVIDER
 *   A provider returns provider figures. REGO's addition is REGO's
 *   business, it depends on rules the client must never see, and
 *   it has to be identical on the results page, the detail page
 *   and at reprice. One place, server-side, or the three disagree.
 *
 * WHY OFFERS ARE PERSISTED BEFORE BEING RETURNED
 *   The id the browser gets back is a row id, not a price it
 *   holds. Everything downstream — detail page, reprice, order —
 *   resolves against the stored row. A client that could hand back
 *   its own offer could name its own fare.
 * ============================================================ */

export const dynamic = "force-dynamic";
/* Flight searches are slow by nature; the default 10s would cut off a
   legitimate multi-city GDS response. */
export const maxDuration = 30;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const PROVIDER_TIMEOUT_MS = 20_000;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const CABINS: CabinClass[] = ["economy", "premium_economy", "business", "first"];
const TRIP_TYPES: TripType[] = ["one_way", "round_trip", "multi_city"];

const IATA = /^[A-Z]{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate the whole request before a provider is touched.
 *
 * Returns a message rather than throwing, so the caller gets one clear
 * sentence instead of a stack trace. Every rule here also exists in the
 * database or the airline's own rules — this is the polite copy, not the
 * control.
 */
function validate(body: unknown): { ok: true; request: FlightSearchRequest } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request." };
  const b = body as Record<string, unknown>;

  const tripType = String(b.tripType ?? "");
  if (!TRIP_TYPES.includes(tripType as TripType)) return { ok: false, error: "Unknown trip type." };

  const cabin = String(b.cabin ?? "economy");
  if (!CABINS.includes(cabin as CabinClass)) return { ok: false, error: "Unknown cabin class." };

  const rawLegs = Array.isArray(b.legs) ? b.legs : [];
  if (rawLegs.length === 0) return { ok: false, error: "Choose where you are flying from and to." };
  if (tripType === "one_way" && rawLegs.length !== 1) return { ok: false, error: "A one-way search has one flight." };
  if (tripType === "round_trip" && rawLegs.length !== 2) return { ok: false, error: "A return search has two flights." };
  /* Six is the practical GDS ceiling for multi-city, and well past what the
     UI should encourage. */
  if (rawLegs.length > 6) return { ok: false, error: "Six flights at most in one search." };

  const legs = [];
  for (const raw of rawLegs) {
    const l = raw as Record<string, unknown>;
    const origin = String(l.origin ?? "").toUpperCase();
    const destination = String(l.destination ?? "").toUpperCase();
    const departureDate = String(l.departureDate ?? "");

    if (!IATA.test(origin) || !IATA.test(destination)) {
      return { ok: false, error: "Choose airports from the list." };
    }
    if (origin === destination) {
      return { ok: false, error: "Departure and arrival airports must be different." };
    }
    if (!ISO_DATE.test(departureDate)) return { ok: false, error: "Choose a departure date." };

    /* Compare dates as strings in UTC. Building a Date from a bare ISO date
       and comparing to now() would reject today's flights for anyone east of
       UTC — which is everybody REGO serves. */
    const today = new Date().toISOString().slice(0, 10);
    if (departureDate < today) return { ok: false, error: "That departure date has passed." };

    legs.push({ origin, destination, departureDate });
  }

  if (legs.length === 2 && legs[1].departureDate < legs[0].departureDate) {
    return { ok: false, error: "The return date is before the departure date." };
  }

  const pax = (b.passengers ?? {}) as Record<string, unknown>;
  const adults = Number(pax.adults ?? 1);
  const children = Number(pax.children ?? 0);
  const infants = Number(pax.infants ?? 0);

  if (!Number.isInteger(adults) || adults < 1) return { ok: false, error: "At least one adult is required." };
  if (!Number.isInteger(children) || children < 0) return { ok: false, error: "Invalid number of children." };
  if (!Number.isInteger(infants) || infants < 0) return { ok: false, error: "Invalid number of infants." };
  /* An infant travels on an adult's lap, so there cannot be more infants
     than adults. Airlines refuse this; better to say so before the search. */
  if (infants > adults) return { ok: false, error: "Each infant must travel with an adult." };
  if (adults + children > 9) return { ok: false, error: "Nine passengers at most per booking." };

  return {
    ok: true,
    request: {
      tripType: tripType as TripType,
      legs,
      passengers: { adults, children, infants },
      cabin: cabin as CabinClass,
      currency: "PKR",
      directOnly: b.directOnly === true,
      maxStops: typeof b.maxStops === "number" ? b.maxStops : undefined,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Markup                                                              */
/* ------------------------------------------------------------------ */

interface MarkupRuleRow {
  id: string;
  scope: string;
  match_value: string | null;
  kind: string;
  value: number;
  currency: string | null;
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  label: string | null;
}

async function loadMarkupRules(sb: SupabaseClient): Promise<MarkupRule[]> {
  const { data, error } = await sb
    .from("flight_markup_rules")
    .select("*")
    .eq("is_active", true);

  /* No rules is a legitimate state — it means zero markup and the customer
     sees the provider fare. A FAILED read is not the same thing, but failing
     the whole search over it would be worse than showing an unmarked-up
     price, so it is logged and treated as none. */
  if (error) {
    console.warn("[flights/search] markup rules unreadable:", error.message);
    return [];
  }

  return ((data as MarkupRuleRow[]) ?? []).map((r) => ({
    id: r.id,
    scope: r.scope as MarkupRule["scope"],
    matchValue: r.match_value,
    kind: r.kind as MarkupRule["kind"],
    value: Number(r.value),
    currency: r.currency,
    priority: r.priority,
    isActive: r.is_active,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    label: r.label,
  }));
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  if (!flightFlags.enabled()) {
    return bad("Flights are not available yet.", 503);
  }

  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;

  if (!sameOrigin(req)) return bad("Invalid origin.", 403);

  /* Search is the expensive endpoint and the obvious scraping target: every
     call costs a provider round trip, and providers bill per search.

     NOTE: limitAndLog is in-memory and therefore PER VERCEL INSTANCE. It
     slows one runaway client; it is not a fleet-wide cap. A shared store is
     required before this is a real limit — see the architecture doc §10. */
  const ip = clientIp(req);
  const limited = limitAndLog(req, `flight-search:${ip}`, 20, 60_000, {
    endpoint: "/api/flights/search",
    category: "flights",
  });
  if (!limited.ok) {
    return bad("Too many searches in a short time. Wait a minute.", 429);
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad("Flight search is not configured on this server.", 503);
  }

  const body = await req.json().catch(() => null);
  const parsed = validate(body);
  if (!parsed.ok) return bad(parsed.error);
  const request = parsed.request;

  const provider = getFlightProvider();
  if (!provider.isConfigured) {
    return bad(`${provider.label} is not configured.`, 503);
  }

  const sb = adminClient();
  const startedAt = Date.now();

  /* Abort the provider rather than letting the function run to its own
     timeout — an orphaned GDS call still costs money. */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  let offers: FlightOffer[] = [];
  let errorKind: string | null = null;

  try {
    offers = await provider.searchFlights(request, {
      correlationId,
      signal: controller.signal,
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });
  } catch (e) {
    const err = e as FlightProviderError;
    errorKind = err?.kind ?? "unknown";
    console.warn(
      `[flights/search] provider ${provider.id} failed`,
      JSON.stringify({ correlationId, kind: errorKind, message: err?.message })
    );
  } finally {
    clearTimeout(timer);
  }

  const durationMs = Date.now() - startedAt;
  const leg = request.legs[0];

  /* The search is recorded whether or not it succeeded. A failed search is
     the more interesting row: it is how a provider going slow becomes
     visible before customers report it. */
  const { data: searchRow } = await sb
    .from("flight_searches")
    .insert({
      trip_type: request.tripType,
      origin: leg.origin,
      destination: leg.destination,
      departure_date: leg.departureDate,
      return_date: request.legs[1]?.departureDate ?? null,
      adults: request.passengers.adults,
      children: request.passengers.children,
      infants: request.passengers.infants,
      cabin: request.cabin,
      currency: request.currency,
      provider: provider.id,
      result_count: offers.length,
      duration_ms: durationMs,
      error_kind: errorKind,
      correlation_id: correlationId,
    })
    .select("id")
    .single();

  if (errorKind) {
    const message =
      errorKind === "timeout"
        ? "The airline system did not respond in time. Please try again."
        : "We could not search flights just now. Please try again.";
    return NextResponse.json({ ok: false, error: message, correlationId }, { status: 502 });
  }

  if (offers.length === 0) {
    return NextResponse.json({
      ok: true,
      searchId: searchRow?.id ?? null,
      offers: [],
      correlationId,
    });
  }

  /* ---- markup, then persist ---- */
  const rules = await loadMarkupRules(sb);
  const now = new Date().toISOString();

  const priced = offers.map((offer) => {
    const first = offer.itineraries[0];
    const firstSeg = first.segments[0];
    const lastSeg = first.segments[first.segments.length - 1];

    const fare = applyMarkup(
      {
        baseFare: offer.fare.providerBaseFare,
        tax: offer.fare.providerTax,
        total: {
          amount: offer.fare.providerBaseFare.amount + offer.fare.providerTax.amount,
          currency: offer.fare.providerBaseFare.currency,
        },
      },
      rules,
      {
        validatingCarrierCode: offer.validatingCarrierCode,
        originCode: firstSeg.originCode,
        destinationCode: lastSeg.destinationCode,
        /* Country codes come from the offer's own airports. The mock supplies
           them; a real adapter must too, or international rules cannot fire. */
        originCountryCode: countryOf(firstSeg.originCode),
        destinationCountryCode: countryOf(lastSeg.destinationCode),
        cabin: offer.cabin,
        providerId: offer.providerId,
        now,
      },
      {
        conditions: offer.fare.conditions,
        baggage: offer.fare.baggage,
        seatsRemaining: offer.fare.seatsRemaining,
      }
    );

    return { offer: { ...offer, fare }, firstSeg, lastSeg, first };
  });

  const rows = priced.map(({ offer, firstSeg, lastSeg, first }) => ({
    search_id: searchRow?.id ?? null,
    provider: offer.providerId,
    provider_offer_id: offer.providerOfferId,
    offer: offer as unknown as Record<string, unknown>,
    validating_carrier: offer.validatingCarrierCode,
    origin: firstSeg.originCode,
    destination: lastSeg.destinationCode,
    departure_at: firstSeg.departureAt,
    arrival_at: lastSeg.arrivalAt,
    duration_minutes: first.totalDurationMinutes,
    stop_count: first.stopCount,
    cabin: offer.cabin,
    provider_base_fare: offer.fare.providerBaseFare.amount,
    provider_tax: offer.fare.providerTax.amount,
    rego_markup: offer.fare.regoMarkup.amount,
    rego_service_fee: offer.fare.regoServiceFee.amount,
    customer_total: offer.fare.customerTotal.amount,
    currency: offer.fare.customerTotal.currency,
    markup_rule_ids: offer.fare.markupRuleIds,
    is_mock: offer.isMock,
    expires_at: offer.expiresAt,
  }));

  const { data: saved, error: saveError } = await sb
    .from("flight_offers")
    .insert(rows)
    .select("id, provider_offer_id");

  if (saveError) {
    console.warn("[flights/search] could not persist offers:", saveError.message);
    return bad("We found flights but could not hold the prices. Please search again.", 500);
  }

  /* Swap in the stored row ids. From here on the browser refers to offers by
     a row it cannot forge. */
  const idByProviderOffer = new Map(
    (saved ?? []).map((r) => [r.provider_offer_id as string, r.id as string])
  );

  return NextResponse.json({
    ok: true,
    searchId: searchRow?.id ?? null,
    correlationId,
    offers: priced.map(({ offer }) => ({
      ...offer,
      id: idByProviderOffer.get(offer.providerOfferId) ?? offer.id,
    })),
  });
}

/* ------------------------------------------------------------------ */

/**
 * Country for an airport code.
 *
 * Deliberately a lookup against the seeded reference data rather than a
 * network call: it runs once per offer and only decides whether an
 * international markup rule fires. Unknown codes fall back to "??", which
 * makes a route look international — the conservative direction, since
 * treating an international flight as domestic would under-price it.
 */
const COUNTRY_BY_IATA: Record<string, string> = {
  ISB: "PK", KHI: "PK", LHE: "PK", PEW: "PK", UET: "PK", MUX: "PK", SKT: "PK",
  FSD: "PK", KDU: "PK", GIL: "PK", CJL: "PK", GWD: "PK", LYP: "PK", DSK: "PK",
  DXB: "AE", AUH: "AE", SHJ: "AE", DOH: "QA", MCT: "OM", BAH: "BH", KWI: "KW",
  JED: "SA", RUH: "SA", MED: "SA", KUL: "MY", SIN: "SG", BKK: "TH", HKG: "HK",
  PEK: "CN", URC: "CN", DEL: "IN", KTM: "NP", CMB: "LK", DAC: "BD", KBL: "AF",
  THR: "IR", IST: "TR", LHR: "GB", MAN: "GB", BHX: "GB", CDG: "FR", FRA: "DE",
  AMS: "NL", MXP: "IT", BCN: "ES", JFK: "US", YYZ: "CA", SYD: "AU",
};

function countryOf(iata: string): string {
  return COUNTRY_BY_IATA[iata.toUpperCase()] ?? "??";
}
