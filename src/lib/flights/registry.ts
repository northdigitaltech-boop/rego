/* ============================================================
 * Provider selection.
 *
 * SERVER ONLY. Importing this from a client component would pull
 * adapter code — and eventually credentials — into the browser
 * bundle. This repo is public; that mistake is not recoverable by
 * rotating a key.
 *
 * Selection is one environment variable, read at call time rather
 * than at module load, so a flag change takes effect on the next
 * request instead of the next deploy.
 * ============================================================ */

import "server-only";

import type { FlightProvider } from "./provider";
import type { FlightProviderId } from "./types";
import { MockFlightProvider } from "./providers/mock";

const PROVIDERS: Partial<Record<FlightProviderId, () => FlightProvider>> = {
  mock: () => new MockFlightProvider(),
  /* travelport: () => new TravelportProvider(),  ← Phase 5 */
};

/** Cached per provider id — adapters are stateless, so one instance is fine. */
const instances = new Map<FlightProviderId, FlightProvider>();

export function getFlightProviderId(): FlightProviderId {
  const raw = (process.env.FLIGHT_PROVIDER ?? "mock").toLowerCase();
  const known: FlightProviderId[] = ["mock", "travelport", "amadeus", "duffel", "sabre"];
  /* An unrecognised value falls back to mock rather than throwing at import
     time — a typo in an env var should not take the whole site down, and mock
     cannot issue a ticket, so the failure is safe in the right direction. */
  return (known as string[]).includes(raw) ? (raw as FlightProviderId) : "mock";
}

export function getFlightProvider(): FlightProvider {
  const id = getFlightProviderId();
  const cached = instances.get(id);
  if (cached) return cached;

  const factory = PROVIDERS[id];
  if (!factory) {
    throw new Error(
      `FLIGHT_PROVIDER="${id}" has no adapter yet. ` +
        `Available: ${Object.keys(PROVIDERS).join(", ")}.`
    );
  }

  const provider = factory();
  instances.set(id, provider);
  return provider;
}

/* ------------------------------------------------------------------ */
/* Feature flags                                                       */
/* ------------------------------------------------------------------ */

const flag = (name: string): boolean => process.env[name] === "true";

/**
 * Every flag defaults to OFF.
 *
 * An unset variable must never mean "take money" or "issue a ticket". The
 * only way to reach either is to have said so explicitly.
 */
export const flightFlags = {
  enabled: (): boolean => flag("FLIGHTS_ENABLED"),
  bookingEnabled: (): boolean => flag("FLIGHT_BOOKING_ENABLED"),
  paymentEnabled: (): boolean => flag("FLIGHT_PAYMENT_ENABLED"),
  ticketingEnabled: (): boolean => flag("FLIGHT_TICKETING_ENABLED"),
  allowMockTicketing: (): boolean => flag("FLIGHT_ALLOW_MOCK_TICKETING"),
};

/**
 * Guard for anything that spends money.
 *
 * Returns the reason it is not allowed, or null when it is. Callers put the
 * reason in front of the user instead of a generic failure — "ticketing is
 * not enabled yet" is a different problem from "the airline refused".
 */
export function ticketingBlockedReason(): string | null {
  if (!flightFlags.enabled()) return "Flights are not enabled.";
  if (!flightFlags.ticketingEnabled()) return "Ticket issuing is not enabled yet.";
  if (getFlightProviderId() === "mock" && !flightFlags.allowMockTicketing()) {
    return "The mock provider cannot issue real tickets.";
  }
  return null;
}
