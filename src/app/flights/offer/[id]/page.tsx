import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Luggage,
  Plane,
  RefreshCcw,
  TriangleAlert,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { flightFlags } from "@/lib/flights/registry";
import {
  baggageLabel,
  dayOffset,
  formatDateShort,
  formatDuration,
  formatMoney,
  formatTime,
  stopsLabel,
} from "@/lib/flights/format";
import type { FlightItinerary, FlightOffer } from "@/lib/flights/types";

/* ============================================================
 * /flights/offer/[id]
 *
 * Reads the offer REGO stored at search time, never a price the
 * browser hands back. The id is a row id; the fare shown here is
 * the fare that was recorded against it.
 *
 * AN EXPIRED OFFER IS NOT STALE DATA
 *   It is a price nobody will honour. Rather than render it with a
 *   warning and a live Continue button, the page says so and sends
 *   the customer back to search. Carrying an expired fare into
 *   checkout is how somebody reaches a payment screen quoting a
 *   number the airline has already withdrawn.
 *
 * `/flights/offer/…` rather than `/flights/[id]`, so the
 * city-pair SEO routes planned for Phase 8 —
 * /flights/islamabad-to-skardu — keep that namespace.
 * ============================================================ */

export const metadata: Metadata = {
  title: "Flight details",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface OfferRow {
  id: string;
  offer: FlightOffer;
  expires_at: string;
  is_mock: boolean;
}

async function loadOffer(id: string): Promise<OfferRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;

  /* Service role deliberately: the RLS read policy hides expired offers, and
     this page needs to tell an expired offer apart from one that never
     existed. Those are different sentences to the customer. */
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await sb
    .from("flight_offers")
    .select("id, offer, expires_at, is_mock")
    .eq("id", id)
    .maybeSingle();

  return (data as OfferRow) ?? null;
}

export default async function FlightOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!flightFlags.enabled()) notFound();

  const { id } = await params;
  /* A malformed id should 404 rather than reach the database. */
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const row = await loadOffer(id);
  if (!row) notFound();

  const offer = row.offer;
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  const outbound = offer.itineraries[0];
  const inbound = offer.itineraries[1] ?? null;
  const bags = baggageLabel(offer.fare.baggage);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <div className="container-px py-6">
          <Link
            href="/flights"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600 hover:text-gold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to search
          </Link>

          {row.is_mock && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Mock data — development only. This is not a real fare and cannot
              be ticketed.
            </p>
          )}

          {expired && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="flex items-center gap-2 font-display text-lg font-bold text-red-800">
                <Clock className="h-5 w-5" /> This price has expired
              </p>
              <p className="mt-1 text-sm text-red-700">
                Airline fares are held for a short time. Search again to see
                what is available now — the fare may be the same, higher or
                lower.
              </p>
              <Link
                href="/flights"
                className="mt-3 inline-block rounded-xl bg-gradient-forest px-5 py-2.5 text-sm font-bold text-white"
              >
                Search again
              </Link>
            </div>
          )}

          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-5">
              <Itinerary itinerary={outbound} label="Outbound" offer={offer} />
              {inbound && <Itinerary itinerary={inbound} label="Return" offer={offer} />}

              {/* ---- fare conditions ---- */}
              <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
                <h2 className="font-display text-lg font-bold text-forest">
                  Fare conditions
                </h2>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Fact label="Fare type" value={offer.fare.conditions.fareFamily ?? "Standard"} />
                  <Fact label="Cabin" value={cabinLabel(offer.cabin)} />
                  <Fact
                    label="Baggage"
                    value={bags ?? "Check with the airline"}
                    /* Absent baggage data is not "no bags" — saying so would
                       be inventing a fare rule. */
                    muted={!bags}
                  />
                  <Fact
                    label="Refundable"
                    value={
                      offer.fare.conditions.refundable
                        ? offer.fare.conditions.refundPenalty
                          ? `Yes — penalty ${formatMoney(offer.fare.conditions.refundPenalty)}`
                          : "Yes"
                        : "No"
                    }
                  />
                  <Fact
                    label="Changes"
                    value={
                      offer.fare.conditions.changeable
                        ? offer.fare.conditions.changePenalty
                          ? `Allowed — fee ${formatMoney(offer.fare.conditions.changePenalty)}`
                          : "Allowed"
                        : "Not allowed"
                    }
                  />
                </dl>

                {offer.fare.conditions.rulesText && (
                  <p className="mt-4 whitespace-pre-line rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                    {offer.fare.conditions.rulesText}
                  </p>
                )}
              </section>
            </div>

            {/* ---- price ---- */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
                <h2 className="font-display text-lg font-bold text-forest">
                  Price breakdown
                </h2>

                <dl className="mt-3 space-y-2 text-sm">
                  <Row label="Base fare" value={formatMoney(offer.fare.providerBaseFare)} />
                  <Row label="Taxes and charges" value={formatMoney(offer.fare.providerTax)} />
                  {offer.fare.regoMarkup.amount > 0 && (
                    <Row label="Rego service charge" value={formatMoney(offer.fare.regoMarkup)} />
                  )}
                  {offer.fare.regoServiceFee.amount > 0 && (
                    <Row label="Booking fee" value={formatMoney(offer.fare.regoServiceFee)} />
                  )}
                  <div className="border-t border-border pt-2">
                    <Row
                      label={`Total for ${paxLabel(offer)}`}
                      value={formatMoney(offer.fare.customerTotal)}
                      strong
                    />
                  </div>
                </dl>

                {/* Booking is a later phase. A disabled button that explains
                    itself beats a live one that fails at the next screen. */}
                <button
                  type="button"
                  disabled
                  className="mt-4 w-full cursor-not-allowed rounded-xl bg-muted px-4 py-3 text-sm font-bold text-muted-foreground"
                >
                  Continue to booking
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Booking opens once Rego&apos;s airline ticketing is live.
                </p>

                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Fares change until they are confirmed with the airline. Your
                  final price is shown before you pay.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ */

function cabinLabel(c: FlightOffer["cabin"]): string {
  return {
    economy: "Economy",
    premium_economy: "Premium Economy",
    business: "Business",
    first: "First",
  }[c];
}

function paxLabel(offer: FlightOffer): string {
  const { adults, children, infants } = offer.passengers;
  const n = adults + children + infants;
  return `${n} ${n === 1 ? "traveller" : "travellers"}`;
}

function Itinerary({
  itinerary,
  label,
  offer,
}: {
  itinerary: FlightItinerary;
  label: string;
  offer: FlightOffer;
}) {
  const first = itinerary.segments[0];
  const last = itinerary.segments[itinerary.segments.length - 1];
  const offset = dayOffset(first.departureAt, last.arrivalAt);

  return (
    <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-forest">
          {label} · {first.originCode} → {last.destinationCode}
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatDateShort(first.departureAt)} · {formatDuration(itinerary.totalDurationMinutes)} ·{" "}
          {stopsLabel(itinerary.stopCount)}
        </p>
      </div>

      {offset && (
        <p className="mt-1 text-xs font-semibold text-amber-700">
          Arrives {offset === "+1" ? "the next day" : `${offset} days`}
        </p>
      )}

      <ol className="mt-4 space-y-3">
        {itinerary.segments.map((s, i) => {
          const layover = itinerary.layovers[i];
          return (
            <li key={s.id}>
              <div className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-bold text-forest">
                    <Plane className="h-3.5 w-3.5" />
                    {s.carrierName} {s.carrierCode}
                    {s.flightNumber}
                  </span>
                  {s.aircraftName && <span>{s.aircraftName}</span>}
                  <span>{cabinLabel(s.cabin)}</span>
                  {s.operatingCarrierName && (
                    <span className="text-amber-700">
                      Operated by {s.operatingCarrierName}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="font-display text-xl font-bold text-forest">
                      {formatTime(s.departureAt)}
                    </p>
                    <p className="text-sm font-semibold text-forest">{s.originCode}</p>
                    {s.originName && (
                      <p className="text-xs text-muted-foreground">{s.originName}</p>
                    )}
                    {s.originTerminal && (
                      <p className="text-xs text-muted-foreground">
                        Terminal {s.originTerminal}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="font-display text-xl font-bold text-forest">
                      {formatTime(s.arrivalAt)}
                    </p>
                    <p className="text-sm font-semibold text-forest">
                      {s.destinationCode}
                    </p>
                    {s.destinationName && (
                      <p className="text-xs text-muted-foreground">{s.destinationName}</p>
                    )}
                    {s.destinationTerminal && (
                      <p className="text-xs text-muted-foreground">
                        Terminal {s.destinationTerminal}
                      </p>
                    )}
                  </div>
                </div>

                <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {formatDuration(s.durationMinutes)}
                </p>
              </div>

              {layover && (
                <p className="mt-2 flex flex-wrap items-center gap-2 px-4 text-xs font-semibold text-amber-700">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(layover.durationMinutes)} in{" "}
                  {layover.airportName ?? layover.airportCode}
                  {layover.changeOfAirport && " — you change airports"}
                  {layover.requiresRecheck === true &&
                    " — you collect and re-check your bags"}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {offer.fare.baggage && baggageLabel(offer.fare.baggage) && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Luggage className="h-4 w-4 text-forest-600" />
          {baggageLabel(offer.fare.baggage)}
        </p>
      )}
      {offer.fare.conditions.refundable && (
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-forest-600">
          <RefreshCcw className="h-4 w-4" /> Refundable fare
        </p>
      )}
    </section>
  );
}

function Fact({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={muted ? "text-sm text-muted-foreground" : "text-sm text-forest"}>
        {value}
      </dd>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? "font-semibold text-forest" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd
        className={
          strong
            ? "font-display text-xl font-bold text-forest"
            : "font-medium text-forest"
        }
      >
        {value}
      </dd>
    </div>
  );
}
