"use client";

import * as React from "react";
import {
  Loader2, ShieldOff, Radar, ChevronDown, Siren, Info, CheckCircle2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Finding {
  ruleId: string;
  ruleTitle: string;
  severity: string;
  subject: string;
  subjectKind: string;
  headline: string;
  reasons: string[];
  observed: number;
  threshold: number;
  windowMinutes: number;
  firstSeen: string;
  lastSeen: string;
  eventIds: string[];
  nextSteps: string[];
  falsePositives: string[];
}

interface RuleInfo {
  id: string;
  title: string;
  severity: string;
  threshold: number;
  windowMinutes: number;
  description: string;
  falsePositives: string[];
}

interface Payload {
  ok: boolean;
  integrated: boolean;
  reason?: string;
  hours?: number;
  eventsExamined?: number;
  truncated?: boolean;
  findings?: Finding[];
  rules: RuleInfo[];
  rulesVersion: number;
  limitations?: string[];
  error?: string;
}

const SEV_STYLE: Record<string, string> = {
  critical: "bg-red-950 text-red-300 border-red-800",
  high: "bg-orange-950 text-orange-300 border-orange-800",
  medium: "bg-amber-950 text-amber-300 border-amber-800",
  low: "bg-sky-950 text-sky-300 border-sky-800",
  info: "bg-slate-800 text-slate-400 border-slate-700",
};

export default function CyberThreatsPage() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [err, setErr] = React.useState("");
  const [hours, setHours] = React.useState(24);
  const [open, setOpen] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [opened, setOpened] = React.useState<Record<string, boolean>>({});

  const load = React.useCallback(async () => {
    setErr("");
    setData(null);
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return setErr("Session expired. Sign in again.");
    try {
      const r = await fetch(`/api/cyber/threats?hours=${hours}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await r.json()) as Payload;
      if (!j.ok) return setErr(j.error || "Could not load.");
      setData(j);
    } catch {
      setErr("Could not reach the security API.");
    }
  }, [hours]);

  React.useEffect(() => { load(); }, [load]);

  const openIncident = async (f: Finding) => {
    setBusy(f.ruleId + f.subject);
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) { setBusy(null); return setErr("Session expired."); }
    try {
      const r = await fetch("/api/cyber/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "create",
          title: `${f.ruleTitle} — ${f.subject}`,
          severity: f.severity,
          summary: [f.headline, ...f.reasons].join("\n"),
          ruleId: f.ruleId,
          rulesVersion: data?.rulesVersion,
          eventIds: f.eventIds,
        }),
      });
      const j = await r.json();
      if (j.ok) setOpened((p) => ({ ...p, [f.ruleId + f.subject]: true }));
      else setErr(j.error || "Could not open the incident.");
    } catch {
      setErr("Could not reach the security API.");
    }
    setBusy(null);
  };

  const findings = data?.findings ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Threat Detection</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Threshold rules run over recorded events. Every finding shows its
            own arithmetic so you can judge it rather than trust it.
          </p>
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

      {data && !data.integrated && (
        <div className="rounded-2xl border border-dashed border-amber-900/60 bg-amber-950/20 p-6">
          <ShieldOff className="h-6 w-6 text-amber-500" />
          <p className="mt-3 font-semibold text-amber-200">Not integrated</p>
          <p className="mt-1 max-w-xl text-sm text-amber-200/70">{data.reason}</p>
        </div>
      )}

      {data?.integrated && (
        <>
          <p className="text-xs text-slate-500">
            {data.eventsExamined} event{data.eventsExamined === 1 ? "" : "s"} examined ·
            {" "}{data.rules.length} rules · ruleset v{data.rulesVersion}
          </p>

          {findings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 py-14 text-center">
              <Radar className="mx-auto h-8 w-8 text-slate-700" />
              <p className="mt-2 text-sm font-semibold text-slate-400">
                No rule crossed its threshold
              </p>
              {/* Never say "you are secure". */}
              <p className="mx-auto mt-1 max-w-lg text-xs text-slate-600">
                This means nothing recorded in this window matched a rule. It is
                not a clean bill of health — read the limitations below for what
                these rules cannot see.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map((f) => {
                const key = f.ruleId + f.subject;
                const isOpen = open === key;
                return (
                  <div key={key} className="rounded-2xl border border-slate-800 bg-slate-900/40">
                    <button
                      onClick={() => setOpen(isOpen ? null : key)}
                      className="flex w-full items-start gap-3 p-4 text-left"
                    >
                      <span className={cn(
                        "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                        SEV_STYLE[f.severity] ?? SEV_STYLE.info
                      )}>
                        {f.severity}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-100">{f.headline}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {f.ruleTitle} · {f.observed}/{f.threshold} in {f.windowMinutes} min ·
                          {" "}last {new Date(f.lastSeen).toLocaleString()}
                        </span>
                      </span>
                      <ChevronDown className={cn(
                        "mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform",
                        isOpen && "rotate-180"
                      )} />
                    </button>

                    {isOpen && (
                      <div className="space-y-4 border-t border-slate-800 px-4 py-4 text-sm">
                        <Section title="Why this fired">
                          {f.reasons.map((r) => <Bullet key={r}>{r}</Bullet>)}
                        </Section>
                        <Section title="What to check next">
                          {f.nextSteps.map((r) => <Bullet key={r}>{r}</Bullet>)}
                        </Section>
                        {/* Shown by default, not hidden behind a link. An analyst
                            should see the innocent explanation before they act. */}
                        <Section title="Ways this could be a false positive">
                          {f.falsePositives.map((r) => <Bullet key={r}>{r}</Bullet>)}
                        </Section>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          {opened[key] ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Incident opened
                            </span>
                          ) : (
                            <button
                              onClick={() => openIncident(f)}
                              disabled={busy === key}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                            >
                              {busy === key
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Siren className="h-3.5 w-3.5" />}
                              Open an incident from this
                            </button>
                          )}
                          <span className="text-xs text-slate-600">
                            {f.eventIds.length} event{f.eventIds.length === 1 ? "" : "s"} will be attached as evidence
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {data.limitations && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <Info className="h-3.5 w-3.5" /> What this engine cannot detect
              </p>
              <ul className="mt-2 space-y-1.5">
                {data.limitations.map((l) => (
                  <li key={l} className="flex gap-2 text-xs leading-relaxed text-slate-500">
                    <span className="text-slate-700">•</span>{l}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-400">
              The {data.rules.length} rules in full
            </summary>
            <div className="mt-3 space-y-3">
              {data.rules.map((r) => (
                <div key={r.id} className="border-l-2 border-slate-800 pl-3">
                  <p className="text-sm font-semibold text-slate-200">{r.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{r.description}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-600">
                    {r.id} · fires at {r.threshold} in {r.windowMinutes} min · {r.severity}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-1.5 space-y-1">{children}</ul>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-xs leading-relaxed text-slate-400">
      <span className="text-slate-700">•</span>{children}
    </li>
  );
}
