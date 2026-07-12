"use client";

import * as React from "react";
import { Plane, ArrowRightLeft, Calendar, Users, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Airports Rego highlights — GB first, then major Pakistan hubs. */
const AIRPORTS: { code: string; city: string; gb?: boolean }[] = [
  { code: "GIL", city: "Gilgit", gb: true },
  { code: "KDU", city: "Skardu", gb: true },
  { code: "ISB", city: "Islamabad" },
  { code: "LHE", city: "Lahore" },
  { code: "KHI", city: "Karachi" },
  { code: "PEW", city: "Peshawar" },
  { code: "UET", city: "Quetta" },
  { code: "LYP", city: "Faisalabad" },
  { code: "MUX", city: "Multan" },
  { code: "SKT", city: "Sialkot" },
];

const cityOf = (code: string) =>
  AIRPORTS.find((a) => a.code === code)?.city ?? code;

const today = () => new Date().toISOString().slice(0, 10);

export function FlightSearch() {
  const [trip, setTrip] = React.useState<"round" | "oneway">("round");
  const [from, setFrom] = React.useState("ISB");
  const [to, setTo] = React.useState("KDU");
  const [depart, setDepart] = React.useState(today());
  const [ret, setRet] = React.useState("");
  const [pax, setPax] = React.useState(1);
  const [cabin, setCabin] = React.useState("Economy");

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const search = () => {
    const parts = [`Flights from ${cityOf(from)} to ${cityOf(to)}`];
    if (depart) parts.push(`on ${depart}`);
    if (trip === "round" && ret) parts.push(`returning ${ret}`);
    parts.push(`${pax} ${pax > 1 ? "passengers" : "passenger"}`);
    if (cabin !== "Economy") parts.push(cabin);
    const q = encodeURIComponent(parts.join(" "));
    window.open(`https://www.google.com/travel/flights?q=${q}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium-lg sm:p-6">
      {/* Trip type */}
      <div className="mb-4 flex gap-2">
        {(["round", "oneway"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTrip(t)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
              trip === t
                ? "bg-gradient-forest text-white shadow-soft"
                : "border border-border bg-card text-forest hover:bg-muted"
            )}
          >
            {t === "round" ? "Round trip" : "One way"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_1fr_1fr_auto]">
        {/* From */}
        <Field label="From" icon={Plane}>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="flight-input">
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code}){a.gb ? " · GB" : ""}
              </option>
            ))}
          </select>
        </Field>

        {/* Swap */}
        <button
          onClick={swap}
          aria-label="Swap airports"
          className="hidden h-11 w-11 shrink-0 place-self-end rounded-xl border border-border bg-card text-forest transition-colors hover:bg-muted lg:grid lg:place-items-center"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </button>

        {/* To */}
        <Field label="To" icon={Plane}>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="flight-input">
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code}){a.gb ? " · GB" : ""}
              </option>
            ))}
          </select>
        </Field>

        {/* Depart */}
        <Field label="Depart" icon={Calendar}>
          <input type="date" min={today()} value={depart} onChange={(e) => setDepart(e.target.value)} className="flight-input" />
        </Field>

        {/* Return */}
        <Field label="Return" icon={Calendar}>
          <input
            type="date"
            min={depart || today()}
            value={ret}
            disabled={trip === "oneway"}
            onChange={(e) => setRet(e.target.value)}
            className="flight-input disabled:opacity-40"
          />
        </Field>

        {/* Search */}
        <div className="flex items-end">
          <Button variant="gold" size="lg" className="h-11 w-full rounded-xl lg:w-auto" onClick={search}>
            <Search className="h-4 w-4" /> Search
          </Button>
        </div>
      </div>

      {/* Passengers + cabin */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-md">
        <Field label="Passengers" icon={Users}>
          <select value={pax} onChange={(e) => setPax(Number(e.target.value))} className="flight-input">
            {Array.from({ length: 9 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} {i + 1 > 1 ? "passengers" : "passenger"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cabin" icon={Plane}>
          <select value={cabin} onChange={(e) => setCabin(e.target.value)} className="flight-input">
            {["Economy", "Premium economy", "Business", "First"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        We compare live fares across airlines and open the best results for your
        route. Booking is completed on the airline / partner checkout.
      </p>

      <style jsx>{`
        .flight-input {
          width: 100%;
          border: none;
          background: transparent;
          padding: 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: inherit;
        }
        .flight-input:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Plane;
  children: React.ReactNode;
}) {
  return (
    <label className="block rounded-xl border border-border bg-card px-3 py-2">
      <span className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </span>
      {children}
    </label>
  );
}
