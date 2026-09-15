"use client";

import * as React from "react";
import {
  Clock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plane,
  TriangleAlert,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { formatDateShort, formatMoney, formatTime, formatDuration } from "@/lib/flights/format";
import type { FlightOffer } from "@/lib/flights/types";

/* ============================================================
 * The concierge queue.
 *
 * Rego's team works flight requests here instead of out of an
 * inbox. An inbox is fine for the first ten and useless by the
 * fiftieth: nothing says who already replied, nothing shows what
 * is still waiting, and two people call the same customer.
 *
 * ORDERED BY WHO HAS WAITED LONGEST, not newest first. A request
 * that has sat for three days is the problem; the one that
 * arrived a minute ago is not.
 * ============================================================ */

interface RequestRow {
  id: string;
  reference: string;
  status: string;
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string | null;
  cabin: string;
  adults: number;
  children: number;
  infants: number;
  quoted_total: number | null;
  quoted_currency: string | null;
  confirmed_total: number | null;
  confirmed_currency: string | null;
  airline_ref: string | null;
  agent_note: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  itinerary_snapshot: FlightOffer;
  created_at: string;
}

const OPEN_STATUSES = ["new", "contacted", "quoted", "confirmed"];

const STATUS_TONE: Record<string, string> = {
  new: "bg-amber-100 text-amber-900",
  contacted: "bg-blue-50 text-blue-800",
  quoted: "bg-blue-50 text-blue-800",
  confirmed: "bg-forest-50 text-forest-700",
  booked: "bg-emerald-50 text-emerald-800",
  declined: "bg-muted text-muted-foreground",
  cancelled: "bg-red-50 text-red-700",
};

const NEXT_STATUS: { id: string; label: string }[] = [
  { id: "contacted", label: "Contacted" },
  { id: "quoted", label: "Quoted" },
  { id: "confirmed", label: "Confirmed" },
  { id: "booked", label: "Booked" },
  { id: "declined", label: "Decline" },
];

export function AdminFlightRequests() {
  const [rows, setRows] = React.useState<RequestRow[] | null>(null);
  const [filter, setFilter] = React.useState<"open" | "all">("open");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState("");
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  const load = React.useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([]);
      return;
    }
    const { data } = await supabase
      .from("flight_requests")
      .select("*")
      /* Oldest first — the queue is a waiting list, not a news feed. */
      .order("created_at", { ascending: true });
    setRows((data as RequestRow[]) ?? []);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const act = async (
    id: string,
    status: string,
    extra?: { agentNote?: string; confirmedTotal?: string; airlineRef?: string }
  ) => {
    setBusy(id);
    setNote(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/flight-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ id, status, ...extra }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setNote({ ok: false, text: json.error ?? "That did not save." });
        return;
      }
      setNote({
        ok: true,
        text:
          status === "quoted"
            ? "Saved — the customer has been emailed the quote."
            : status === "booked"
              ? "Saved — the customer has been emailed the confirmation."
              : "Saved.",
      });
      await load();
    } finally {
      setBusy("");
    }
  };

  if (rows === null) {
    return (
      <div className="grid h-40 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-forest-600" />
      </div>
    );
  }

  const shown = filter === "open" ? rows.filter((r) => OPEN_STATUSES.includes(r.status)) : rows;
  const waiting = rows.filter((r) => r.status === "new").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-forest">Flight requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Travellers who picked a flight on Rego and asked the team to book it.
          </p>
        </div>
        <div className="flex gap-2">
          {(["open", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold",
                filter === f
                  ? "bg-gradient-forest text-white shadow-soft"
                  : "border border-border bg-card text-forest hover:bg-muted"
              )}
            >
              {f === "open" ? "Open" : "All"}
              {f === "open" && waiting > 0 && (
                <span className="ml-2 rounded-full bg-gold px-1.5 text-[10px] font-bold text-forest-900">
                  {waiting}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {note && (
        <p
          className={
            note.ok
              ? "rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-700"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {note.text}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
          <Plane className="mx-auto h-9 w-9 text-forest-600/50" />
          <p className="mt-3 font-semibold text-forest">
            {filter === "open" ? "Nothing waiting" : "No requests yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Requests arrive from the flight detail page.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const open = openId === r.id;
            const days = Math.floor(
              (Date.now() - new Date(r.created_at).getTime()) / 86_400_000
            );
            const offer = r.itinerary_snapshot;
            const out = offer?.itineraries?.[0];

            return (
              <li key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      STATUS_TONE[r.status] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {r.status}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-forest">
                      {r.origin} → {r.destination}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {formatDateShort(`${r.departure_date}T00:00:00Z`)}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.reference} · {r.customer_name}
                    </span>
                  </span>

                  {r.quoted_total !== null && r.quoted_currency && (
                    <span className="shrink-0 font-display text-sm font-bold text-forest">
                      {formatMoney({ amount: r.quoted_total, currency: r.quoted_currency })}
                    </span>
                  )}

                  {/* Age, not date. Three days waiting is the fact that matters. */}
                  {r.status === "new" && days >= 1 && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">
                      <Clock className="h-3 w-3" />
                      {days}d waiting
                    </span>
                  )}
                </button>

                {open && (
                  <div className="space-y-4 border-t border-border bg-muted/20 px-4 py-4">
                    {offer?.isMock && (
                      <p className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                        This itinerary came from mock data. Treat the route and
                        dates as what the customer wants — not as a real fare.
                      </p>
                    )}

                    {/* ---- contact ---- */}
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Fact icon={Users} label="Travellers">
                        {r.adults} adult{r.adults > 1 ? "s" : ""}
                        {r.children > 0 && `, ${r.children} child`}
                        {r.infants > 0 && `, ${r.infants} infant`}
                        {` · ${r.cabin.replace("_", " ")}`}
                      </Fact>
                      <Fact icon={Phone} label="Phone">
                        <a href={`tel:${r.customer_phone}`} className="font-semibold text-forest-600 hover:underline">
                          {r.customer_phone}
                        </a>
                      </Fact>
                      <Fact icon={Mail} label="Email">
                        <a href={`mailto:${r.customer_email}`} className="font-semibold text-forest-600 hover:underline">
                          {r.customer_email}
                        </a>
                      </Fact>
                    </div>

                    {r.notes && (
                      <p className="rounded-xl bg-card p-3 text-sm text-muted-foreground">
                        <span className="font-semibold text-forest">Customer note: </span>
                        {r.notes}
                      </p>
                    )}

                    {/* ---- the flight they chose ---- */}
                    {out && (
                      <div className="rounded-xl border border-border bg-card p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" /> What they picked
                        </p>
                        <ol className="space-y-1.5 text-sm">
                          {out.segments.map((s) => (
                            <li key={s.id} className="text-forest">
                              <span className="font-bold">
                                {s.carrierCode}
                                {s.flightNumber}
                              </span>{" "}
                              {s.originCode} {formatTime(s.departureAt)} → {s.destinationCode}{" "}
                              {formatTime(s.arrivalAt)}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {formatDuration(s.durationMinutes)}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <RequestActions
                      row={r}
                      busy={busy === r.id}
                      onAct={(status, extra) => act(r.id, status, extra)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RequestActions({
  row,
  busy,
  onAct,
}: {
  row: RequestRow;
  busy: boolean;
  onAct: (status: string, extra?: { agentNote?: string; confirmedTotal?: string; airlineRef?: string }) => void;
}) {
  const [agentNote, setAgentNote] = React.useState(row.agent_note ?? "");
  const [confirmedTotal, setConfirmedTotal] = React.useState(
    row.confirmed_total !== null ? String(row.confirmed_total / 100) : ""
  );
  const [airlineRef, setAirlineRef] = React.useState(row.airline_ref ?? "");

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Confirmed price (PKR)
          </span>
          <input
            type="number"
            min="0"
            value={confirmedTotal}
            onChange={(e) => setConfirmedTotal(e.target.value)}
            placeholder="What the airline actually quoted"
            className="auth-input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Airline reference (PNR)
          </span>
          <input
            value={airlineRef}
            onChange={(e) => setAirlineRef(e.target.value)}
            placeholder="Once booked"
            className="auth-input"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Note to the customer
        </span>
        <textarea
          rows={2}
          value={agentNote}
          onChange={(e) => setAgentNote(e.target.value)}
          placeholder="Included in the quote and booking emails."
          className="auth-input resize-none"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        {NEXT_STATUS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={busy || row.status === s.id}
            onClick={() => onAct(s.id, { agentNote, confirmedTotal, airlineRef })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40",
              s.id === "booked"
                ? "bg-gradient-forest text-white"
                : s.id === "declined"
                  ? "border border-border text-red-600 hover:bg-red-50"
                  : "border border-border text-forest hover:bg-muted"
            )}
          >
            {s.label}
          </button>
        ))}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-forest-600" />}
      </div>

      {/* Which buttons email, said before they are pressed rather than after. */}
      <p className="mt-2 text-[11px] text-muted-foreground">
        <strong>Quoted</strong> emails the confirmed price.{" "}
        <strong>Booked</strong> emails the PNR. The others are internal.
      </p>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Users;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="text-sm text-forest">{children}</p>
    </div>
  );
}
