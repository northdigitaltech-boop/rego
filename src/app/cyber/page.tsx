"use client";

import * as React from "react";
import {
  ShieldCheck, AlertTriangle, Siren, Bug, Globe, UserCog, Loader2, Info,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/* ============================================================
 * Security Overview.
 *
 * Every figure here is counted from real rows by /api/cyber/summary.
 * Anything without a data source renders "Not integrated" — never a zero,
 * never a green tick. A dashboard that invents reassurance is worse than
 * no dashboard.
 * ============================================================ */

interface Summary {
  ok: boolean;
  generatedAt: string;
  events: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  } | null;
  openIncidents: number | null;
  openVulns: number | null;
  blockedIps: number | null;
  adminActions24h: number | null;
  admins: number | null;
  notIntegrated: string[];
}

export default function CyberOverviewPage() {
  const [data, setData] = React.useState<Summary | null>(null);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return setErr("Session expired.");
      try {
        const r = await fetch("/api/cyber/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (!j.ok) return setErr(j.error || "Could not load.");
        setData(j as Summary);
      } catch {
        setErr("Could not reach the security API.");
      }
    })();
  }, []);

  if (err) {
    return (
      <p className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
        {err}
      </p>
    );
  }
  if (!data) {
    return (
      <div className="grid h-40 place-items-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const sev = data.events?.bySeverity ?? {};
  const critical = sev.critical ?? 0;
  const high = sev.high ?? 0;

  /* Posture is derived, not decorative — it reflects what is actually
     unresolved right now. */
  const posture =
    data.events === null
      ? { label: "Not monitoring", tone: "slate" as const,
          note: "Security event logging is not set up yet." }
      : critical > 0
        ? { label: "Critical attention", tone: "red" as const,
            note: `${critical} critical event${critical === 1 ? "" : "s"} in the last 24 hours.` }
        : high > 0 || (data.openIncidents ?? 0) > 0
          ? { label: "Needs review", tone: "amber" as const,
              note: "Open items require your attention." }
          : { label: "Nominal", tone: "green" as const,
              note: "No critical or high-severity events in the last 24 hours." };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-white">
          Security Overview
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Last 24 hours · updated{" "}
          {new Date(data.generatedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* Posture */}
      <div
        className={cn(
          "rounded-2xl border p-5",
          posture.tone === "red" && "border-red-900/60 bg-red-950/40",
          posture.tone === "amber" && "border-amber-900/60 bg-amber-950/30",
          posture.tone === "green" && "border-emerald-900/60 bg-emerald-950/30",
          posture.tone === "slate" && "border-slate-800 bg-slate-900/50"
        )}
      >
        <div className="flex items-start gap-3">
          <ShieldCheck
            className={cn(
              "mt-0.5 h-6 w-6 shrink-0",
              posture.tone === "red" && "text-red-400",
              posture.tone === "amber" && "text-amber-400",
              posture.tone === "green" && "text-emerald-400",
              posture.tone === "slate" && "text-slate-500"
            )}
          />
          <div>
            <p className="font-display text-lg font-bold text-white">
              {posture.label}
            </p>
            <p className="mt-0.5 text-sm text-slate-400">{posture.note}</p>
          </div>
        </div>
      </div>

      {/* Counters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Stat label="Critical (24h)" value={data.events ? critical : null} icon={AlertTriangle} danger={critical > 0} />
        <Stat label="High (24h)" value={data.events ? high : null} icon={AlertTriangle} danger={high > 0} />
        <Stat label="Security events (24h)" value={data.events?.total ?? null} icon={ShieldCheck} />
        <Stat label="Open incidents" value={data.openIncidents} icon={Siren} danger={(data.openIncidents ?? 0) > 0} />
        <Stat label="Open vulnerabilities" value={data.openVulns} icon={Bug} danger={(data.openVulns ?? 0) > 0} />
        <Stat label="Blocked IPs" value={data.blockedIps} icon={Globe} />
        <Stat label="Admin actions (24h)" value={data.adminActions24h} icon={UserCog} />
        <Stat label="Admin accounts" value={data.admins} icon={UserCog} />
      </div>

      {/* By category */}
      {data.events && Object.keys(data.events.byCategory).length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm font-semibold text-white">Events by category</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(data.events.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <span
                  key={k}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300"
                >
                  {k} · <span className="font-bold text-white">{n}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Honest gaps */}
      {data.notIntegrated.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Info className="h-4 w-4 text-slate-400" /> No data source yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            These are shown as unmonitored rather than reported as healthy.
          </p>
          <ul className="mt-3 space-y-1.5">
            {data.notIntegrated.map((n) => (
              <li key={n} className="flex items-center gap-2 text-sm text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                {n}
                <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  Not integrated
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  danger = false,
}: {
  label: string;
  value: number | null;
  icon: typeof ShieldCheck;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      {value === null ? (
        <p className="mt-2 text-sm font-semibold text-slate-600">Not integrated</p>
      ) : (
        <p
          className={cn(
            "mt-1 font-display text-2xl font-bold",
            danger ? "text-red-400" : "text-white"
          )}
        >
          {value}
        </p>
      )}
    </div>
  );
}
