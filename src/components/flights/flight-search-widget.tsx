"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Minus, Plus, Plane, Search, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { AirportAutocomplete } from "@/components/flights/airport-autocomplete";
import { CABIN_LABELS } from "@/lib/flights/provider";
import type { Airport, CabinClass, TripType } from "@/lib/flights/types";

/* ============================================================
 * The search widget.
 *
 * Everything it produces is a URL. The results page reads the
 * query string and searches from that, which means a search is
 * shareable, bookmarkable, survives a refresh, and the back button
 * behaves — none of which is true if the criteria live in React
 * state.
 *
 * Validation here is the polite copy. The API validates everything
 * again server-side, because a query string is user input.
 * ============================================================ */

const TRIP_TYPES: { id: TripType; label: string }[] = [
  { id: "one_way", label: "One way" },
  { id: "round_trip", label: "Round trip" },
  { id: "multi_city", label: "Multi-city" },
];

const CABINS: CabinClass[] = ["economy", "premium_economy", "business", "first"];

interface Leg {
  from: Airport | null;
  to: Airport | null;
  date: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function FlightSearchWidget({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  const [tripType, setTripType] = React.useState<TripType>("round_trip");
  const [legs, setLegs] = React.useState<Leg[]>([
    { from: null, to: null, date: "" },
  ]);
  const [returnDate, setReturnDate] = React.useState("");
  const [cabin, setCabin] = React.useState<CabinClass>("economy");
  const [adults, setAdults] = React.useState(1);
  const [children, setChildren] = React.useState(0);
  const [infants, setInfants] = React.useState(0);
  const [paxOpen, setPaxOpen] = React.useState(false);
  const [error, setError] = React.useState("");

  const paxRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!paxRef.current?.contains(e.target as Node)) setPaxOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const setLeg = (i: number, patch: Partial<Leg>) =>
    setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const swap = (i: number) =>
    setLegs((prev) =>
      prev.map((l, idx) => (idx === i ? { from: l.to, to: l.from, date: l.date } : l))
    );

  /* Multi-city only. Each new leg starts where the previous one ended, which
     is what a multi-city trip almost always means. */
  const addLeg = () =>
    setLegs((prev) =>
      prev.length >= 6
        ? prev
        : [...prev, { from: prev[prev.length - 1]?.to ?? null, to: null, date: "" }]
    );

  const removeLeg = (i: number) =>
    setLegs((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const paxLabel = () => {
    const total = adults + children + infants;
    const bits = [`${total} ${total === 1 ? "traveller" : "travellers"}`];
    return `${bits.join(", ")} · ${CABIN_LABELS[cabin]}`;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const active = tripType === "multi_city" ? legs : [legs[0]];

    for (const [i, leg] of active.entries()) {
      if (!leg.from || !leg.to) {
        setError(`Choose both airports for flight ${i + 1}.`);
        return;
      }
      if (leg.from.iataCode === leg.to.iataCode) {
        setError("Departure and arrival airports must be different.");
        return;
      }
      if (!leg.date) {
        setError(`Choose a date for flight ${i + 1}.`);
        return;
      }
    }

    if (tripType === "round_trip") {
      if (!returnDate) {
        setError("Choose a return date.");
        return;
      }
      if (returnDate < active[0].date) {
        setError("The return date is before the departure date.");
        return;
      }
    }

    if (infants > adults) {
      setError("Each infant must travel with an adult — add another adult.");
      return;
    }

    const params = new URLSearchParams({
      trip: tripType,
      cabin,
      adults: String(adults),
      children: String(children),
      infants: String(infants),
    });

    active.forEach((leg, i) => {
      params.append(`o${i}`, leg.from!.iataCode);
      params.append(`d${i}`, leg.to!.iataCode);
      params.append(`t${i}`, leg.date);
    });
    if (tripType === "round_trip") params.set("ret", returnDate);

    router.push(`/flights/search?${params.toString()}`);
  };

  const showMulti = tripType === "multi_city";
  const visibleLegs = showMulti ? legs : legs.slice(0, 1);

  return (
    <form
      onSubmit={submit}
      className={cn(
        "rounded-3xl border border-border/70 bg-card shadow-premium",
        compact ? "p-4" : "p-5 sm:p-6"
      )}
    >
      {/* ---- trip type ---- */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TRIP_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTripType(t.id);
              if (t.id !== "multi_city") setLegs((p) => p.slice(0, 1));
              if (t.id === "multi_city" && legs.length === 1) addLeg();
            }}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              tripType === t.id
                ? "bg-gradient-forest text-white shadow-soft"
                : "border border-border bg-card text-forest hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- legs ---- */}
      <div className="space-y-3">
        {visibleLegs.map((leg, i) => (
          <div key={i} className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_200px_auto]">
            <AirportAutocomplete
              id={`from-${i}`}
              label={showMulti ? `Flight ${i + 1} — From` : "From"}
              value={leg.from}
              onChange={(a) => setLeg(i, { from: a })}
              excludeCode={leg.to?.iataCode ?? null}
            />

            <div className="flex items-end justify-center pb-1 lg:pb-2">
              <button
                type="button"
                onClick={() => swap(i)}
                aria-label="Swap airports"
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-forest-600 transition-transform hover:rotate-180 hover:bg-muted"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>

            <AirportAutocomplete
              id={`to-${i}`}
              label="To"
              value={leg.to}
              onChange={(a) => setLeg(i, { to: a })}
              excludeCode={leg.from?.iataCode ?? null}
            />

            <div>
              <label
                htmlFor={`date-${i}`}
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Departure
              </label>
              <input
                id={`date-${i}`}
                type="date"
                value={leg.date}
                min={todayIso()}
                onChange={(e) => setLeg(i, { date: e.target.value })}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-forest focus:outline-none focus:ring-2 focus:ring-forest-600"
              />
            </div>

            {showMulti && legs.length > 1 && (
              <div className="flex items-end pb-1">
                <button
                  type="button"
                  onClick={() => removeLeg(i)}
                  aria-label={`Remove flight ${i + 1}`}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}

        {tripType === "round_trip" && (
          <div className="lg:max-w-[200px]">
            <label
              htmlFor="return-date"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Return
            </label>
            <input
              id="return-date"
              type="date"
              value={returnDate}
              min={legs[0].date || todayIso()}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-forest focus:outline-none focus:ring-2 focus:ring-forest-600"
            />
          </div>
        )}

        {showMulti && legs.length < 6 && (
          <button
            type="button"
            onClick={addLeg}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600 hover:text-gold"
          >
            <Plus className="h-4 w-4" /> Add another flight
          </button>
        )}
      </div>

      {/* ---- passengers & cabin ---- */}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div ref={paxRef} className="relative">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Travellers &amp; cabin
          </label>
          <button
            type="button"
            onClick={() => setPaxOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm font-semibold text-forest hover:bg-muted"
          >
            <Users className="h-4 w-4 text-forest-600" />
            {paxLabel()}
          </button>

          {paxOpen && (
            <div className="absolute z-40 mt-1 w-full min-w-[300px] rounded-2xl border border-border bg-card p-4 shadow-premium-lg">
              <Counter
                label="Adults"
                hint="12 and over"
                value={adults}
                min={1}
                max={9}
                onChange={setAdults}
              />
              <Counter
                label="Children"
                hint="2–11"
                value={children}
                min={0}
                max={8}
                onChange={setChildren}
              />
              <Counter
                label="Infants"
                hint="Under 2, on a lap"
                value={infants}
                min={0}
                /* Capped at the adult count in the control itself, so the
                   rule is discoverable rather than a rejection later. */
                max={adults}
                onChange={setInfants}
              />

              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Cabin
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CABINS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCabin(c)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                        cabin === c
                          ? "border-forest bg-forest-50 text-forest"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {CABIN_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-8 text-sm font-bold text-white shadow-soft transition-transform hover:-translate-y-0.5 sm:w-auto"
          >
            <Search className="h-4 w-4" /> Search flights
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Plane className="h-3.5 w-3.5" />
        Prices shown include taxes and any REGO service fee. The final fare is
        confirmed with the airline before you pay.
      </p>
    </form>
  );
}

function Counter({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-semibold text-forest">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-border text-forest disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-5 text-center text-sm font-bold text-forest">{value}</span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-border text-forest disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
