"use client";

import * as React from "react";
import { Loader2, Search, ChevronLeft, ChevronRight, Activity } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface SecEvent {
  id: string;
  detected_at: string;
  event_type: string;
  category: string;
  severity: string;
  risk_score: number;
  actor_email: string | null;
  actor_role: string | null;
  ip_address: string | null;
  country: string | null;
  endpoint: string | null;
  status: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
}

const CATEGORIES = [
  "all", "auth", "authz", "admin", "api", "booking",
  "db", "upload", "session", "ratelimit", "infra",
];
const SEVERITIES = ["all", "critical", "high", "medium", "low", "info"];

const SEV_STYLE: Record<string, string> = {
  critical: "bg-red-950 text-red-300 border-red-800",
  high: "bg-orange-950 text-orange-300 border-orange-800",
  medium: "bg-amber-950 text-amber-300 border-amber-800",
  low: "bg-sky-950 text-sky-300 border-sky-800",
  info: "bg-slate-800 text-slate-400 border-slate-700",
};

export default function CyberEventsPage() {
  const [events, setEvents] = React.useState<SecEvent[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [category, setCategory] = React.useState("all");
  const [severity, setSeverity] = React.useState("all");
  const [actor, setActor] = React.useState("");
  const [hours, setHours] = React.useState(24);
  const [err, setErr] = React.useState("");

  const size = 50;

  const load = React.useCallback(async () => {
    setErr("");
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return setErr("Session expired.");

    const qs = new URLSearchParams({
      category, severity, actor,
      hours: String(hours), page: String(page), size: String(size),
    });
    try {
      const r = await fetch(`/api/cyber/events?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!j.ok) return setErr(j.error || "Could not load.");
      setEvents(j.events);
      setTotal(j.total);
    } catch {
      setErr("Could not reach the security API.");
    }
  }, [category, severity, actor, hours, page]);

  React.useEffect(() => { load(); }, [load]);

  const pages = Math.ceil(total / size);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Live Security Events</h1>
        <p className="mt-1 text-sm text-slate-400">
          {total} event{total === 1 ? "" : "s"} in the last {hours}h
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onChange={(v) => { setCategory(v); setPage(0); }} options={CATEGORIES} label="Category" />
        <Select value={severity} onChange={(v) => { setSeverity(v); setPage(0); }} options={SEVERITIES} label="Severity" />
        <Select
          value={String(hours)}
          onChange={(v) => { setHours(Number(v)); setPage(0); }}
          options={["1", "24", "168", "720"]}
          label="Window"
          render={(v) => (v === "1" ? "1 hour" : v === "24" ? "24 hours" : v === "168" ? "7 days" : "30 days")}
        />
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={actor}
            onChange={(e) => { setActor(e.target.value); setPage(0); }}
            placeholder="Filter by actor email…"
            className="w-52 bg-transparent py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {err && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {err}
        </p>
      )}

      {!events && !err && (
        <div className="grid h-32 place-items-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {events && events.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-800 py-16 text-center">
          <Activity className="mx-auto h-8 w-8 text-slate-700" />
          <p className="mt-2 text-sm font-semibold text-slate-400">No events recorded</p>
          <p className="mt-1 text-xs text-slate-600">
            Nothing matched these filters in this window.
          </p>
        </div>
      )}

      {events && events.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5 font-semibold">Time</th>
                <th className="px-3 py-2.5 font-semibold">Event</th>
                <th className="px-3 py-2.5 font-semibold">Category</th>
                <th className="px-3 py-2.5 font-semibold">Actor</th>
                <th className="px-3 py-2.5 font-semibold">IP</th>
                <th className="px-3 py-2.5 font-semibold">Severity</th>
                <th className="px-3 py-2.5 font-semibold">Risk</th>
                <th className="px-3 py-2.5 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40">
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                    {new Date(e.detected_at).toLocaleString("en-GB")}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-200">
                    {e.event_type}
                    {e.description && (
                      <span className="block text-xs text-slate-500">{e.description}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">{e.category}</td>
                  <td className="px-3 py-2.5 text-slate-400">{e.actor_email ?? "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{e.ip_address ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-bold",
                      SEV_STYLE[e.severity] ?? SEV_STYLE.info
                    )}>
                      {e.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-300">{e.risk_score}</td>
                  <td className="px-3 py-2.5">
                    {/* Provenance matters: client-reported rows are signal,
                        not evidence, and the table says so. */}
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-500">
                      {(e.metadata as { source?: string } | null)?.source === "client"
                        ? "client"
                        : "server"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Page {page + 1} of {pages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Select({
  value, onChange, options, label, render,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
  render?: (v: string) => string;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{render ? render(o) : o}</option>
        ))}
      </select>
    </label>
  );
}
