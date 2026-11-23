"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  Clock,
  Loader2,
  Mail,
  Mountain,
  Phone,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  expeditionBookingRef,
  getExpeditionBookingsByOwner,
  setExpeditionBookingStatus,
  type ExpeditionBookingRow,
} from "@/lib/expeditions";

/* ============================================================
 * Quote requests, on the provider's dashboard.
 *
 * WHY CONTACT DETAILS ARE SHOWN IN FULL
 *   The traveller sent them on purpose, to this provider, so that
 *   they could be called back. Hiding a phone number behind
 *   another click would only mean the provider copies it into
 *   WhatsApp one step later. The policy is what limits who sees
 *   this row — the provider it was sent to, the traveller who
 *   sent it, and an admin. Nobody else, including other providers.
 *
 * WHY THERE IS NO PRICE FIELD
 *   Rego does not process payments. The quote is agreed between
 *   the two of them; this screen records only whether the
 *   provider took the job.
 * ============================================================ */

const FILTERS = [
  { id: "pending", label: "New" },
  { id: "accepted", label: "Accepted" },
  { id: "all", label: "All" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

export function ExpeditionRequests({ ownerEmail }: { ownerEmail: string }) {
  const [rows, setRows] = React.useState<ExpeditionBookingRow[] | null>(null);
  const [filter, setFilter] = React.useState<Filter>("pending");
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setRows(await getExpeditionBookingsByOwner(ownerEmail));
  }, [ownerEmail]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const decide = async (
    row: ExpeditionBookingRow,
    status: "accepted" | "rejected" | "completed"
  ) => {
    setBusy(row.id);
    setError("");
    const { error: dbErr } = await setExpeditionBookingStatus(row.id, status);
    setBusy("");
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    await load();
  };

  if (rows === null) {
    return (
      <div className="grid h-40 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-forest-600" />
      </div>
    );
  }

  const shown =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const newCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors " +
              (filter === f.id
                ? "bg-gradient-forest text-white shadow-soft"
                : "border border-border bg-card text-forest hover:bg-muted")
            }
          >
            {f.label}
            {f.id === "pending" && newCount > 0 && (
              <span className="ml-2 rounded-full bg-gold px-2 text-[10px] font-bold text-forest-900">
                {newCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
          <Mountain className="mx-auto h-10 w-10 text-forest-600/50" />
          <p className="mt-3 font-semibold text-forest">
            {filter === "pending" ? "No new requests" : "Nothing here"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Requests from your profile and packages arrive here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold text-forest">
                    {r.subject_title || "Expedition enquiry"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {expeditionBookingRef(r.id)} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <StatusPill status={r.status} />
              </div>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <Line icon={Users} label="Group">
                  {r.people} {r.people === 1 ? "person" : "people"}
                  {r.experience_level ? ` · ${r.experience_level}` : ""}
                </Line>
                {(r.peak || r.route) && (
                  <Line icon={Mountain} label="Objective">
                    {[r.peak, r.route].filter(Boolean).join(" · ")}
                  </Line>
                )}
                {(r.start_date || r.end_date || r.days) && (
                  <Line icon={CalendarDays} label="When">
                    {[
                      r.start_date && r.end_date
                        ? `${r.start_date} → ${r.end_date}`
                        : r.start_date || r.end_date,
                      r.days ? `${r.days} days` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Line>
                )}
                <Line icon={Phone} label="Contact">
                  {r.customer_name || "—"}
                  {r.customer_phone ? (
                    <>
                      {" · "}
                      <a
                        href={`tel:${r.customer_phone}`}
                        className="font-semibold text-forest-600 hover:underline"
                      >
                        {r.customer_phone}
                      </a>
                    </>
                  ) : null}
                </Line>
                <Line icon={Mail} label="Email">
                  <a
                    href={`mailto:${r.customer_email}`}
                    className="font-semibold text-forest-600 hover:underline"
                  >
                    {r.customer_email}
                  </a>
                </Line>
              </dl>

              {r.notes && (
                <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  {r.notes}
                </p>
              )}

              {r.status === "cancelled" && (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Cancelled
                  {r.cancelled_by ? ` by ${r.cancelled_by}` : ""}
                  {r.cancellation_reason ? ` — ${r.cancellation_reason}` : ""}
                </p>
              )}

              {/* A decided request keeps its buttons off: changing your mind
                  is a conversation, not a toggle. Completed is the exception,
                  because a job ends after it was accepted. */}
              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      variant="gold"
                      disabled={busy === r.id}
                      onClick={() => decide(r, "accepted")}
                    >
                      <Check className="h-4 w-4" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === r.id}
                      onClick={() => decide(r, "rejected")}
                    >
                      <X className="h-4 w-4" /> Decline
                    </Button>
                  </>
                )}
                {r.status === "accepted" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === r.id}
                    onClick={() => decide(r, "completed")}
                  >
                    <Check className="h-4 w-4" /> Mark completed
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    accepted: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    completed: "bg-forest-50 text-forest-600",
    cancelled: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={
        "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold capitalize " +
        (map[status] ?? "bg-muted text-muted-foreground")
      }
    >
      {status === "pending" && <Clock className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

function Line({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Users;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="text-sm text-forest">{children}</dd>
      </div>
    </div>
  );
}
