"use client";

import * as React from "react";
import { Loader2, BellOff, Bell, ShieldOff, Info } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/* ============================================================
 * Alerts.
 *
 * This page shows what WOULD be alert-worthy. It is a view, not
 * a delivery channel — nothing here emails, texts or pages
 * anyone. That is stated on screen rather than implied, because
 * an "Alerts" page that silently delivers nothing is the most
 * dangerous kind of security theatre: it makes you stop checking.
 * ============================================================ */

interface Finding {
  ruleId: string;
  ruleTitle: string;
  severity: string;
  subject: string;
  headline: string;
  observed: number;
  threshold: number;
  windowMinutes: number;
  lastSeen: string;
}

const SEV_STYLE: Record<string, string> = {
  critical: "bg-red-950 text-red-300 border-red-800",
  high: "bg-orange-950 text-orange-300 border-orange-800",
};

export default function CyberAlertsPage() {
  const [findings, setFindings] = React.useState<Finding[] | null>(null);
  const [integrated, setIntegrated] = React.useState(true);
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const t = s.session?.access_token;
      if (!t) return setErr("Session expired. Sign in again.");
      try {
        const r = await fetch("/api/cyber/threats?hours=168", {
          headers: { Authorization: `Bearer ${t}` },
        });
        const j = await r.json();
        if (!j.ok) return setErr(j.error || "Could not load.");
        setIntegrated(j.integrated !== false);
        setReason(j.reason ?? "");
        // Alert-worthy means critical or high. Everything else lives
        // on the Threat Detection page and does not belong here.
        setFindings(
          (j.findings ?? []).filter(
            (f: Finding) => f.severity === "critical" || f.severity === "high"
          )
        );
      } catch {
        setErr("Could not reach the security API.");
      }
    })();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Alerts</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Critical and high findings from the last 7 days.
        </p>
      </div>

      {/* The most important thing on this page. */}
      <div className="flex gap-3 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-4">
        <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="text-xs leading-relaxed text-amber-200/80">
          <p className="font-bold text-amber-200">Nothing here is delivered to you.</p>
          <p className="mt-1">
            There is no email, SMS or push alerting wired up. These findings
            appear only when you open this page, so treat it as something you
            check — not something that will reach you. If an attack happens
            overnight, you will read about it in the morning.
          </p>
        </div>
      </div>

      {err && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {err}
        </p>
      )}

      {!findings && !err && (
        <div className="grid h-32 place-items-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {findings && !integrated && (
        <div className="rounded-2xl border border-dashed border-amber-900/60 bg-amber-950/20 p-6">
          <ShieldOff className="h-6 w-6 text-amber-500" />
          <p className="mt-3 font-semibold text-amber-200">Not integrated</p>
          <p className="mt-1 max-w-xl text-sm text-amber-200/70">{reason}</p>
        </div>
      )}

      {findings && integrated && findings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-800 py-14 text-center">
          <Bell className="mx-auto h-8 w-8 text-slate-700" />
          <p className="mt-2 text-sm font-semibold text-slate-400">
            No critical or high findings this week
          </p>
          <p className="mx-auto mt-1 max-w-lg text-xs text-slate-600">
            Nothing recorded crossed a critical or high threshold. Lower-severity
            findings, if any, are on the Threat Detection page.
          </p>
        </div>
      )}

      {findings && integrated && findings.length > 0 && (
        <div className="space-y-2">
          {findings.map((f) => (
            <div
              key={f.ruleId + f.subject}
              className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <span className={cn(
                "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                SEV_STYLE[f.severity]
              )}>
                {f.severity}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-100">{f.headline}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {f.ruleTitle} · {f.observed}/{f.threshold} in {f.windowMinutes} min ·
                  {" "}last {new Date(f.lastSeen).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          <Info className="h-3.5 w-3.5" /> To make these actually reach you
        </p>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-500">
          <li className="flex gap-2">
            <span className="text-slate-700">•</span>
            A scheduled job would need to run this detection on a cadence and
            send a digest through the existing SMTP setup.
          </li>
          <li className="flex gap-2">
            <span className="text-slate-700">•</span>
            That is deliberately not built yet: automatic mail on a rule that
            fires on shared-office IPs would train you to ignore it.
          </li>
          <li className="flex gap-2">
            <span className="text-slate-700">•</span>
            Worth doing once the rules have run against real traffic for a week
            and the false-positive rate is known.
          </li>
        </ul>
      </div>
    </div>
  );
}
