"use client";

import * as React from "react";
import { Ban, Loader2, RefreshCw } from "lucide-react";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/* ============================================================
 * Admin — every booking cancellation, newest first.
 *
 * WHY A LOG AND NOT A BOOKING BROWSER
 *   The admin dashboard has no per-booking view to extend: it
 *   shows a bookings COUNT and nothing else. Building one would
 *   mean a browser across ten tables with ten different column
 *   names — a large new feature, and not what was asked for.
 *   What was asked for is that an admin can see who cancelled a
 *   booking, why, and when. booking_audit_logs holds exactly
 *   that, so this reads it.
 *
 *   Its RLS policy is admin-only SELECT and it has no insert
 *   policy at all — rows are written by /api/booking/cancel
 *   with the service-role key. A history the subject of the
 *   history can edit is not a history.
 * ============================================================ */

interface AuditRow {
  id: string;
  booking_id: string;
  booking_kind: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  note: string | null;
  created_at: string;
}

const PAGE = 100;

export function AdminCancellations() {
  const [rows, setRows] = React.useState<AuditRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  const load = React.useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    const { data, error } = await supabase
      .from("booking_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE);

    if (error) {
      /* Almost always phase93 not having been run. Saying which migration
         is more useful than "failed to load". */
      setErr(
        error.message.includes("does not exist")
          ? "The booking audit log does not exist yet — run phase93-booking-cancellation.sql in Supabase."
          : error.message
      );
      setRows([]);
    } else {
      setRows((data as AuditRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-premium">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-forest">
            <Ban className="h-5 w-5" /> Cancellations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every booking cancellation, across all services. Read-only — this
            log is written by the server and cannot be edited from the app.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {err && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </p>
      )}

      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : rows.length === 0 && !err ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No bookings have been cancelled.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <Th>When</Th>
                <Th>Service</Th>
                <Th>Booking</Th>
                <Th>Cancelled by</Th>
                <Th>Was</Th>
                <Th>Reason</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <Td>
                    {new Date(r.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Td>
                  <Td className="capitalize">{r.booking_kind}</Td>
                  <Td className="font-display text-xs tracking-wider text-forest-600">
                    {shortRef(r.booking_id)}
                  </Td>
                  <Td>
                    <span className="capitalize">{r.actor_role ?? "—"}</span>
                    {r.actor_email && (
                      <span className="block text-xs text-muted-foreground">
                        {r.actor_email}
                      </span>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">
                    {r.from_status ?? "—"} → {r.to_status ?? "—"}
                  </Td>
                  <Td>{r.reason ?? "—"}</Td>
                  <Td className="max-w-[16rem] break-words text-muted-foreground">
                    {r.note ?? "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === PAGE && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing the most recent {PAGE}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-semibold">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 py-3", className)}>{children}</td>;
}

/** Same shortening the booking references use, so the two can be matched up. */
function shortRef(id: string) {
  return "SGB-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
