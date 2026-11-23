"use client";

import * as React from "react";
import { Loader2, Users, UserPlus, Repeat, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { loadVisitorSummary, type VisitorTotals } from "@/lib/site-visitors";

/* ============================================================
 * Website visitors — new vs returning.
 *
 * WHAT THE TWO NUMBERS MEAN, EXACTLY
 *   New      a browser seen for the first time ever, counted on
 *            that one day and never again.
 *   Returning a browser that had been seen on an EARLIER day and
 *            came back. Counted once per day it returns, so a
 *            regular visitor contributes several times over a
 *            month — which is the point of the number.
 *
 *   They are therefore not two slices of one pie and the panel
 *   does not draw them as one.
 *
 * ---------------------------------------------------------------------------
 * WHY THE CAVEAT IS ON THE SCREEN AND NOT ONLY IN THIS COMMENT
 *
 * A person on a phone and then a laptop is two visitors. Someone
 * who clears their browser is new again. Private windows are
 * always new. Everyone who declined the cookie banner is
 * invisible entirely.
 *
 * Every analytics product on earth has these limits, including
 * Google's, and every one of them prints a confident number
 * anyway. Somebody will eventually make a decision on this
 * figure, so the screen says what it can and cannot see. A
 * number without its error bars invites more confidence than it
 * has earned.
 * ---------------------------------------------------------------------------
 * ============================================================ */

const RANGES = [7, 30, 90] as const;

export function AdminVisitors() {
  const [days, setDays] = React.useState<(typeof RANGES)[number]>(30);
  const [data, setData] = React.useState<VisitorTotals | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    loadVisitorSummary(days)
      .then((d) => {
        if (alive) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days]);

  const peak = Math.max(1, ...(data?.days ?? []).map((d) => d.totalVisitors));
  const recent = (data?.days ?? []).slice(-14);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-premium">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-forest">Website visitors</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            People who opened Rego, and how many had been before.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-border p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                days === r ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted"
              )}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-forest-600" />
        </div>
      ) : !data || data.days.length === 0 ? (
        /* Not a zero. Zero would claim nobody came; this says nothing has
           been recorded, which is a different and more useful fact when the
           feature was only switched on yesterday. */
        <p className="py-8 text-center text-sm text-muted-foreground">
          No visits recorded yet. Counting starts once <span className="font-semibold text-forest">phase129</span>{" "}
          has been run and a visitor has accepted the cookie notice.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat
              icon={UserPlus}
              label="First-time visitors"
              value={data.newVisitors}
              hint="Counted once, on the day they first arrived"
            />
            <Stat
              icon={Repeat}
              label="Return visits"
              value={data.repeatVisitors}
              hint="Each day a known visitor came back"
            />
            <Stat
              icon={Users}
              label="Busiest day"
              value={Math.max(...data.days.map((d) => d.totalVisitors))}
              hint="Most visitors in a single day"
            />
          </div>

          {/* Two stacked bars per day. No axis labels and no tooltips: this is
              a shape, for spotting a spike or a dead week. The table below is
              where exact numbers live. */}
          <div className="mt-5 flex h-28 items-end gap-1">
            {recent.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col justify-end gap-0.5" title={`${d.day}: ${d.newVisitors} new, ${d.repeatVisitors} returning`}>
                <div
                  className="w-full rounded-t bg-gold"
                  style={{ height: `${(d.newVisitors / peak) * 100}%` }}
                />
                <div
                  className="w-full rounded-b bg-forest-600"
                  style={{ height: `${(d.repeatVisitors / peak) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-gold" /> First-time
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-forest-600" /> Returning
            </span>
            <span className="ml-auto">Last {recent.length} days shown</span>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[380px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Day</th>
                  <th className="px-3 py-2 text-right font-semibold">First-time</th>
                  <th className="px-3 py-2 text-right font-semibold">Returning</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...data.days].reverse().map((d) => (
                  <tr key={d.day} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{d.day}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gold-700">{d.newVisitors}</td>
                    <td className="px-3 py-2 text-right font-semibold text-forest">{d.repeatVisitors}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{d.totalVisitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Counted per browser, so one person on a phone and a laptop is two. Clearing
              browser data, or a private window, looks like a new visitor. Anyone who
              declined the cookie notice is not counted at all &mdash; so treat these as a
              reliable <em>trend</em> and an undercount of the true total.
            </span>
          </p>
        </>
      )}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-forest text-gold">
          <Icon className="h-4 w-4" />
        </span>
        <p className="font-display text-2xl font-bold text-forest">{value.toLocaleString("en-GB")}</p>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-forest">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
