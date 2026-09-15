"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { FlightCard } from "@/components/flights/flight-card";
import { formatDuration, formatMoney } from "@/lib/flights/format";
import type { CabinClass, FlightOffer, TripType } from "@/lib/flights/types";

/* ============================================================
 * Results.
 *
 * Criteria come from the URL, so a search is shareable and the
 * back button works. The fetch happens once per URL; filtering and
 * sorting are client-side over the offers already returned,
 * because re-searching on every filter toggle would cost a
 * provider call each time — and providers bill per search.
 * ============================================================ */

type SortId = "recommended" | "cheapest" | "fastest" | "earliest" | "latest";

const SORTS: { id: SortId; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "cheapest", label: "Cheapest" },
  { id: "fastest", label: "Fastest" },
  { id: "earliest", label: "Earliest departure" },
  { id: "latest", label: "Latest departure" },
];

interface Filters {
  maxPrice: number | null;
  airlines: string[];
  maxStops: number | null;
  baggageOnly: boolean;
  refundableOnly: boolean;
  departFrom: number;
  departTo: number;
}

const EMPTY: Filters = {
  maxPrice: null,
  airlines: [],
  maxStops: null,
  baggageOnly: false,
  refundableOnly: false,
  departFrom: 0,
  departTo: 24,
};

export function FlightResults() {
  const params = useSearchParams();
  const qs = params.toString();

  const [offers, setOffers] = React.useState<FlightOffer[] | null>(null);
  const [error, setError] = React.useState("");
  const [sort, setSort] = React.useState<SortId>("recommended");
  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  /* ---- search ---- */
  React.useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setOffers(null);
      setError("");
      setFilters(EMPTY);

      const body = bodyFromParams(params);
      if (!body) {
        setError("That search link is incomplete. Please search again.");
        setOffers([]);
        return;
      }

      try {
        const res = await fetch("/api/flights/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const json = (await res.json()) as {
          ok: boolean;
          offers?: FlightOffer[];
          error?: string;
        };

        if (!json.ok) {
          setError(json.error ?? "We could not search flights just now.");
          setOffers([]);
          return;
        }
        setOffers(json.offers ?? []);
      } catch (e) {
        /* An abort is the component being replaced, not a failure. */
        if ((e as Error).name === "AbortError") return;
        setError("We could not reach the flight search. Please try again.");
        setOffers([]);
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  /* ---- available filter values, from the results themselves ---- */
  const airlines = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const o of offers ?? []) m.set(o.validatingCarrierCode, o.validatingCarrierName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [offers]);

  const priceBounds = React.useMemo(() => {
    if (!offers || offers.length === 0) return null;
    const amounts = offers.map((o) => o.fare.customerTotal.amount);
    return { min: Math.min(...amounts), max: Math.max(...amounts) };
  }, [offers]);

  const shown = React.useMemo(() => {
    if (!offers) return [];
    const out = offers.filter((o) => {
      const f = o.itineraries[0];
      const depHour = Number(f.segments[0].departureAt.slice(11, 13));

      if (filters.maxPrice !== null && o.fare.customerTotal.amount > filters.maxPrice) return false;
      if (filters.airlines.length > 0 && !filters.airlines.includes(o.validatingCarrierCode)) return false;
      if (filters.maxStops !== null && f.stopCount > filters.maxStops) return false;
      if (filters.baggageOnly && !(o.fare.baggage.checkedPieces ?? 0)) return false;
      if (filters.refundableOnly && !o.fare.conditions.refundable) return false;
      if (depHour < filters.departFrom || depHour >= filters.departTo) return false;
      return true;
    });

    return sortOffers(out, sort);
  }, [offers, filters, sort]);

  const activeFilterCount =
    (filters.maxPrice !== null ? 1 : 0) +
    (filters.airlines.length > 0 ? 1 : 0) +
    (filters.maxStops !== null ? 1 : 0) +
    (filters.baggageOnly ? 1 : 0) +
    (filters.refundableOnly ? 1 : 0) +
    (filters.departFrom !== 0 || filters.departTo !== 24 ? 1 : 0);

  const filterPanel = (
    <FilterPanel
      filters={filters}
      setFilters={setFilters}
      airlines={airlines}
      priceBounds={priceBounds}
      currency={offers?.[0]?.fare.customerTotal.currency ?? "PKR"}
    />
  );

  return (
    <div className="container-px py-6">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* ---- desktop filters ---- */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
            {filterPanel}
          </div>
        </aside>

        <div className="min-w-0">
          {/* ---- sort + mobile filter trigger ---- */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-forest lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-gold px-1.5 text-[10px] font-bold text-forest-900">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSort(s.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    sort === s.id
                      ? "bg-gradient-forest text-white shadow-soft"
                      : "border border-border bg-card text-forest hover:bg-muted"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {offers && (
              <span className="ml-auto text-xs text-muted-foreground">
                {shown.length} of {offers.length}{" "}
                {offers.length === 1 ? "result" : "results"}
              </span>
            )}
          </div>

          {/* ---- states ---- */}
          {offers === null ? (
            <SearchSkeleton />
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
              <p className="mt-3 font-semibold text-red-800">{error}</p>
            </div>
          ) : offers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center">
              <p className="font-display text-lg font-semibold text-forest">
                No flights found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different date, or a nearby airport.
              </p>
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center">
              <p className="font-display text-lg font-semibold text-forest">
                No flights match your filters
              </p>
              <button
                type="button"
                onClick={() => setFilters(EMPTY)}
                className="mt-3 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-forest hover:bg-muted"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {shown.map((o) => (
                <FlightCard key={o.id} offer={o} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- mobile filter sheet ---- */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/50 lg:hidden">
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-bold text-forest">Filters</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="text-muted-foreground hover:text-forest"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {filterPanel}
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="mt-5 w-full rounded-xl bg-gradient-forest px-4 py-3 text-sm font-bold text-white"
            >
              Show {shown.length} {shown.length === 1 ? "flight" : "flights"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function sortOffers(list: FlightOffer[], sort: SortId): FlightOffer[] {
  const out = [...list];
  switch (sort) {
    case "cheapest":
      return out.sort((a, b) => a.fare.customerTotal.amount - b.fare.customerTotal.amount);
    case "fastest":
      return out.sort(
        (a, b) => a.itineraries[0].totalDurationMinutes - b.itineraries[0].totalDurationMinutes
      );
    case "earliest":
      return out.sort((a, b) =>
        a.itineraries[0].segments[0].departureAt.localeCompare(
          b.itineraries[0].segments[0].departureAt
        )
      );
    case "latest":
      return out.sort((a, b) =>
        b.itineraries[0].segments[0].departureAt.localeCompare(
          a.itineraries[0].segments[0].departureAt
        )
      );
    default: {
      /* "Recommended" is price and duration together, normalised against the
         cheapest and quickest in this result set. Stated rather than secret:
         a hidden ranking on a travel site is usually somebody's commission,
         and this one is not. */
      const minPrice = Math.min(...out.map((o) => o.fare.customerTotal.amount));
      const minDur = Math.min(...out.map((o) => o.itineraries[0].totalDurationMinutes));
      const score = (o: FlightOffer) =>
        (o.fare.customerTotal.amount / minPrice) * 0.65 +
        (o.itineraries[0].totalDurationMinutes / minDur) * 0.35;
      return out.sort((a, b) => score(a) - score(b));
    }
  }
}

function bodyFromParams(p: URLSearchParams): Record<string, unknown> | null {
  const trip = (p.get("trip") ?? "one_way") as TripType;
  const legs: { origin: string; destination: string; departureDate: string }[] = [];

  for (let i = 0; i < 6; i++) {
    const o = p.get(`o${i}`);
    const d = p.get(`d${i}`);
    const t = p.get(`t${i}`);
    if (!o || !d || !t) break;
    legs.push({ origin: o, destination: d, departureDate: t });
  }
  if (legs.length === 0) return null;

  /* A round trip is two legs to the API; the widget stores the return date
     separately because that is how the form reads. */
  if (trip === "round_trip") {
    const ret = p.get("ret");
    if (!ret) return null;
    legs.push({
      origin: legs[0].destination,
      destination: legs[0].origin,
      departureDate: ret,
    });
  }

  return {
    tripType: trip,
    legs,
    cabin: (p.get("cabin") ?? "economy") as CabinClass,
    passengers: {
      adults: Number(p.get("adults") ?? 1),
      children: Number(p.get("children") ?? 0),
      infants: Number(p.get("infants") ?? 0),
    },
  };
}

/* ------------------------------------------------------------------ */

function FilterPanel({
  filters,
  setFilters,
  airlines,
  priceBounds,
  currency,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  airlines: [string, string][];
  priceBounds: { min: number; max: number } | null;
  currency: string;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-forest">Filters</p>
        <button
          type="button"
          onClick={() => setFilters(EMPTY)}
          className="text-xs font-semibold text-forest-600 hover:text-gold"
        >
          Clear
        </button>
      </div>

      {priceBounds && priceBounds.max > priceBounds.min && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Max price
          </p>
          <input
            type="range"
            min={priceBounds.min}
            max={priceBounds.max}
            step={100}
            value={filters.maxPrice ?? priceBounds.max}
            onChange={(e) => set("maxPrice", Number(e.target.value))}
            className="w-full accent-forest-600"
          />
          <p className="mt-1 text-xs font-semibold text-forest">
            up to{" "}
            {formatMoney({
              amount: filters.maxPrice ?? priceBounds.max,
              currency,
            })}
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Stops
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { v: 0, l: "Direct" },
            { v: 1, l: "1 stop" },
            { v: 2, l: "2+ stops" },
          ].map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => set("maxStops", filters.maxStops === s.v ? null : s.v)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                filters.maxStops === s.v
                  ? "bg-gradient-forest text-white"
                  : "border border-border text-forest hover:bg-muted"
              )}
            >
              {s.l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Departure time
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { f: 0, t: 6, l: "Night" },
            { f: 6, t: 12, l: "Morning" },
            { f: 12, t: 18, l: "Afternoon" },
            { f: 18, t: 24, l: "Evening" },
          ].map((w) => {
            const on = filters.departFrom === w.f && filters.departTo === w.t;
            return (
              <button
                key={w.l}
                type="button"
                onClick={() =>
                  setFilters((x) =>
                    on
                      ? { ...x, departFrom: 0, departTo: 24 }
                      : { ...x, departFrom: w.f, departTo: w.t }
                  )
                }
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  on
                    ? "bg-gradient-forest text-white"
                    : "border border-border text-forest hover:bg-muted"
                )}
              >
                {w.l}
              </button>
            );
          })}
        </div>
      </div>

      {airlines.length > 1 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Airlines
          </p>
          <div className="space-y-1.5">
            {airlines.map(([code, name]) => (
              <label key={code} className="flex items-center gap-2 text-sm text-forest">
                <input
                  type="checkbox"
                  checked={filters.airlines.includes(code)}
                  onChange={(e) =>
                    set(
                      "airlines",
                      e.target.checked
                        ? [...filters.airlines, code]
                        : filters.airlines.filter((c) => c !== code)
                    )
                  }
                  className="h-4 w-4 accent-forest-600"
                />
                <span className="truncate">{name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm text-forest">
          <input
            type="checkbox"
            checked={filters.baggageOnly}
            onChange={(e) => set("baggageOnly", e.target.checked)}
            className="h-4 w-4 accent-forest-600"
          />
          Checked bag included
        </label>
        <label className="flex items-center gap-2 text-sm text-forest">
          <input
            type="checkbox"
            checked={filters.refundableOnly}
            onChange={(e) => set("refundableOnly", e.target.checked)}
            className="h-4 w-4 accent-forest-600"
          />
          Refundable only
        </label>
      </div>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-4">
      <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Searching airlines… this can take up to {formatDuration(1)}
      </p>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-3xl border border-border/70 bg-muted/40"
        />
      ))}
    </div>
  );
}
