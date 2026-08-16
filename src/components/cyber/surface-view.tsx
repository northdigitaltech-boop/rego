"use client";

import * as React from "react";
import { Loader2, Info, ShieldOff, Inbox } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/* ============================================================
 * Shared renderer for the six attack-surface pages.
 *
 * Deliberately unable to invent data: it renders exactly what
 * /api/cyber/surface returns. When the API says integrated:false
 * it shows why, and when it returns zero rows it says "nothing
 * recorded" — never a green all-clear.
 * ============================================================ */

interface Bucket {
  key: string;
  events: number;
  highestSeverity: string;
  topRisk: number;
  lastSeen: string;
  types: Record<string, number>;
}

interface Payload {
  ok: boolean;
  integrated: boolean;
  reason?: string;
  hours: number;
  totalEvents?: number;
  bySeverity?: Record<string, number>;
  groups?: Bucket[];
  reputation?: Record<string, { block_status: string; risk_score: number }>;
  gaps: string[];
  error?: string;
}

const SEV_STYLE: Record<string, string> = {
  critical: "bg-red-950 text-red-300 border-red-800",
  high: "bg-orange-950 text-orange-300 border-orange-800",
  medium: "bg-amber-950 text-amber-300 border-amber-800",
  low: "bg-sky-950 text-sky-300 border-sky-800",
  info: "bg-slate-800 text-slate-400 border-slate-700",
};

export function SurfaceView({
  view,
  title,
  subtitle,
  groupLabel,
}: {
  view: "ip" | "api" | "booking" | "database" | "files" | "owner";
  title: string;
  subtitle: string;
  /** Column heading for the grouped key — "IP address", "Endpoint", etc. */
  groupLabel: string;
}) {
  const [data, setData] = React.useState<Payload | null>(null);
  const [err, setErr] = React.useState("");
  const [hours, setHours] = React.useState(168);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr("");
      setData(null);
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return setErr("Session expired. Sign in again.");
      try {
        const r = await fetch(`/api/cyber/surface?view=${view}&hours=${hours}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = (await r.json()) as Payload;
        if (cancelled) return;
        if (!j.ok) return setErr(j.error || "Could not load.");
        setData(j);
      } catch {
        if (!cancelled) setErr("Could not reach the security API.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, hours]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>
        </div>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          aria-label="Time window"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value={24}>Last 24 hours</option>
          <option value={168}>Last 7 days</option>
          <option value={720}>Last 30 days</option>
        </select>
      </div>

      {err && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {err}
        </p>
      )}

      {!data && !err && (
        <div className="grid h-32 place-items-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {/* No data source at all — say so plainly. */}
      {data && !data.integrated && (
        <div className="rounded-2xl border border-dashed border-amber-900/60 bg-amber-950/20 p-6">
          <ShieldOff className="h-6 w-6 text-amber-500" />
          <p className="mt-3 font-semibold text-amber-200">Not integrated</p>
          <p className="mt-1 max-w-xl text-sm text-amber-200/70">{data.reason}</p>
        </div>
      )}

      {data?.integrated && (
        <>
          {/* Severity strip */}
          <div className="flex flex-wrap gap-2">
            {["critical", "high", "medium", "low", "info"].map((s) => (
              <span
                key={s}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-semibold",
                  SEV_STYLE[s]
                )}
              >
                {s} · {data.bySeverity?.[s] ?? 0}
              </span>
            ))}
          </div>

          {data.groups && data.groups.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">{groupLabel}</th>
                    <th className="px-3 py-2.5 font-semibold">Events</th>
                    <th className="px-3 py-2.5 font-semibold">Worst severity</th>
                    <th className="px-3 py-2.5 font-semibold">Peak risk</th>
                    <th className="px-3 py-2.5 font-semibold">Top event types</th>
                    <th className="px-3 py-2.5 font-semibold">Last seen</th>
                    {view === "ip" && (
                      <th className="px-3 py-2.5 font-semibold">Reputation</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((g) => {
                    const rep = data.reputation?.[g.key];
                    return (
                      <tr
                        key={g.key}
                        className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40"
                      >
                        <td className="max-w-[18rem] truncate px-3 py-2.5 font-mono text-xs text-slate-200">
                          {g.key}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-300">
                          {g.events}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[11px] font-bold",
                              SEV_STYLE[g.highestSeverity] ?? SEV_STYLE.info
                            )}
                          >
                            {g.highestSeverity}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{g.topRisk}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-400">
                          {Object.entries(g.types)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([t, n]) => `${t} (${n})`)
                            .join(", ")}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                          {new Date(g.lastSeen).toLocaleString()}
                        </td>
                        {view === "ip" && (
                          <td className="px-3 py-2.5 text-xs">
                            {rep ? (
                              <span className="text-slate-300">
                                {rep.block_status} · {rep.risk_score}
                              </span>
                            ) : (
                              <span className="text-slate-600">no record</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Zero rows is a real answer — but it is not "you are secure". */
            <div className="rounded-2xl border border-dashed border-slate-800 py-14 text-center">
              <Inbox className="mx-auto h-8 w-8 text-slate-700" />
              <p className="mt-2 text-sm font-semibold text-slate-400">
                Nothing recorded in this window
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">
                This means no matching event was written — not that no such
                activity occurred. Read it alongside the coverage gaps below.
              </p>
            </div>
          )}
        </>
      )}

      {/* Always shown. The blind spots are part of the report. */}
      {data && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            <Info className="h-3.5 w-3.5" /> What this page cannot see
          </p>
          <ul className="mt-2 space-y-1.5">
            {data.gaps.map((g) => (
              <li key={g} className="flex gap-2 text-xs leading-relaxed text-slate-500">
                <span className="text-slate-700">•</span>
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
