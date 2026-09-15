"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  Clock,
  Luggage,
  Plane,
  RefreshCcw,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  baggageLabel,
  dayOffset,
  formatDuration,
  formatMoney,
  formatTime,
  stopsLabel,
} from "@/lib/flights/format";
import type { FlightItinerary, FlightOffer } from "@/lib/flights/types";

/* ============================================================
 * One result.
 *
 * WHAT IT REFUSES TO INVENT
 *   Seats remaining, aircraft type and baggage are shown only when
 *   the provider supplied them. An absent baggage allowance is not
 *   "0 bags" and an absent seat count is not "plenty" — on a
 *   results page those guesses become the reason somebody chose
 *   this fare over a cheaper one.
 *
 *   Likewise "Refundable" appears only when the fare says so.
 *   Silence from a provider is not a refund policy.
 * ============================================================ */

export function FlightCard({ offer }: { offer: FlightOffer }) {
  const [open, setOpen] = React.useState(false);
  const outbound = offer.itineraries[0];
  const inbound = offer.itineraries[1] ?? null;

  const bags = baggageLabel(offer.fare.baggage);
  const seats = offer.fare.seatsRemaining;

  return (
    <article className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-shadow hover:shadow-premium-lg">
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-4">
          <ItineraryRow
            itinerary={outbound}
            carrierName={offer.validatingCarrierName}
            carrierCode={offer.validatingCarrierCode}
          />
          {inbound && (
            <>
              <div className="border-t border-dashed border-border" />
              <ItineraryRow
                itinerary={inbound}
                carrierName={offer.validatingCarrierName}
                carrierCode={offer.validatingCarrierCode}
              />
            </>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {offer.fare.conditions.fareFamily && (
              <span className="font-semibold text-forest-600">
                {offer.fare.conditions.fareFamily}
              </span>
            )}
            {bags && (
              <span className="inline-flex items-center gap-1">
                <Luggage className="h-3.5 w-3.5" /> {bags}
              </span>
            )}
            {offer.fare.conditions.refundable && (
              <span className="inline-flex items-center gap-1 text-forest-600">
                <RefreshCcw className="h-3.5 w-3.5" /> Refundable
              </span>
            )}
            {seats !== null && seats <= 5 && (
              /* Only when it is genuinely low. "9 seats left" on every card is
                 the pressure tactic that stops meaning anything. */
              <span className="font-semibold text-amber-700">
                Only {seats} left at this price
              </span>
            )}
          </div>
        </div>

        {/* ---- price ---- */}
        <div className="flex flex-row items-end justify-between gap-3 border-t border-border pt-3 lg:w-48 lg:flex-col lg:items-end lg:justify-center lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="text-right">
            <p className="font-display text-2xl font-bold text-forest">
              {formatMoney(offer.fare.customerTotal)}
            </p>
            <p className="text-xs text-muted-foreground">
              total for {totalPax(offer)}
            </p>
          </div>
          <Link
            href={`/flights/offer/${offer.id}`}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-forest px-6 py-2.5 text-sm font-bold text-white shadow-soft transition-transform hover:-translate-y-0.5"
          >
            Select
          </Link>
        </div>
      </div>

      {/* ---- expandable itinerary ---- */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-2 text-xs font-semibold text-forest-600 hover:bg-muted"
      >
        {open ? "Hide" : "Flight details"}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-border bg-muted/30 px-4 py-4 sm:px-5">
          <SegmentList itinerary={outbound} label="Outbound" />
          {inbound && <SegmentList itinerary={inbound} label="Return" />}
        </div>
      )}
    </article>
  );
}

function totalPax(offer: FlightOffer): string {
  const { adults, children, infants } = offer.passengers;
  const n = adults + children + infants;
  return `${n} ${n === 1 ? "traveller" : "travellers"}`;
}

/* ------------------------------------------------------------------ */

function ItineraryRow({
  itinerary,
  carrierName,
  carrierCode,
}: {
  itinerary: FlightItinerary;
  carrierName: string;
  carrierCode: string;
}) {
  const first = itinerary.segments[0];
  const last = itinerary.segments[itinerary.segments.length - 1];
  const offset = dayOffset(first.departureAt, last.arrivalAt);

  return (
    <div className="flex items-center gap-4">
      <div className="hidden w-12 shrink-0 sm:block">
        <span
          title={carrierName}
          className="grid h-10 w-10 place-items-center rounded-xl bg-forest-50 text-xs font-bold text-forest-600"
        >
          {carrierCode}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0 text-right">
          <p className="font-display text-xl font-bold leading-tight text-forest">
            {formatTime(first.departureAt)}
          </p>
          <p className="text-xs font-semibold text-muted-foreground">{first.originCode}</p>
        </div>

        <div className="min-w-0 flex-1 px-1">
          <p className="text-center text-[11px] text-muted-foreground">
            {formatDuration(itinerary.totalDurationMinutes)}
          </p>
          <div className="relative my-1 h-px bg-border">
            <Plane className="absolute -top-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-90 bg-card text-forest-600" />
          </div>
          <p className="text-center text-[11px] font-semibold text-muted-foreground">
            {stopsLabel(itinerary.stopCount)}
            {itinerary.stopCount > 0 && (
              <span className="font-normal">
                {" · "}
                {itinerary.layovers.map((l) => l.airportCode).join(", ")}
              </span>
            )}
          </p>
        </div>

        <div className="shrink-0">
          <p className="font-display text-xl font-bold leading-tight text-forest">
            {formatTime(last.arrivalAt)}
            {offset && (
              <sup className="ml-0.5 text-[10px] font-bold text-amber-700">{offset}</sup>
            )}
          </p>
          <p className="text-xs font-semibold text-muted-foreground">
            {last.destinationCode}
          </p>
        </div>
      </div>

      {/* Wider than it was (w-32), and wrapping rather than truncating.
          "Pakistan International Airlines" was cutting to "Pakistan
          Internatio…", which is worse than either showing it or not. */}
      <p className="hidden w-40 shrink-0 text-xs leading-tight text-muted-foreground lg:block">
        {carrierName}
      </p>
    </div>
  );
}

function SegmentList({ itinerary, label }: { itinerary: FlightItinerary; label: string }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ol className="space-y-3">
        {itinerary.segments.map((s, i) => {
          const layover = itinerary.layovers[i];
          return (
            <li key={s.id}>
              <div className="rounded-2xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-bold text-forest">
                    {s.carrierCode} {s.flightNumber}
                  </span>
                  {s.aircraftName && <span>{s.aircraftName}</span>}
                  {s.operatingCarrierName && (
                    /* Worth surfacing: a passenger who booked Qatar and boards
                       an Indigo aircraft should not find out at the gate. */
                    <span className="text-amber-700">
                      Operated by {s.operatingCarrierName}
                    </span>
                  )}
                </div>

                <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  <p className="text-forest">
                    <span className="font-bold">{formatTime(s.departureAt)}</span>{" "}
                    {s.originCode}
                    {s.originName && (
                      <span className="text-muted-foreground"> · {s.originName}</span>
                    )}
                  </p>
                  <p className="text-forest">
                    <span className="font-bold">{formatTime(s.arrivalAt)}</span>{" "}
                    {s.destinationCode}
                    {s.destinationName && (
                      <span className="text-muted-foreground"> · {s.destinationName}</span>
                    )}
                  </p>
                </div>

                <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {formatDuration(s.durationMinutes)}
                </p>
              </div>

              {layover && (
                <p className="mt-2 flex items-center gap-2 px-3 text-xs font-semibold text-amber-700">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(layover.durationMinutes)} layover in{" "}
                  {layover.airportName ?? layover.airportCode}
                  {layover.changeOfAirport && " — airport change"}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
