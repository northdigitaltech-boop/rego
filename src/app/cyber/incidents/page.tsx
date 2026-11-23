"use client";

import * as React from "react";
import { Loader2, ShieldOff, Siren, Lock, Plus, Send } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  summary: string | null;
  opened_by: string | null;
  detected_by_rule: string | null;
  detected_at: string;
  resolved_at: string | null;
}

interface Note {
  id: string;
  author_email: string;
  kind: string;
  body: string;
  status_from: string | null;
  status_to: string | null;
  created_at: string;
}

const STATUSES = [
  "open", "investigating", "contained", "eradicated",
  "recovering", "resolved", "false_positive",
];

const SEV_STYLE: Record<string, string> = {
  critical: "bg-red-950 text-red-300 border-red-800",
  high: "bg-orange-950 text-orange-300 border-orange-800",
  medium: "bg-amber-950 text-amber-300 border-amber-800",
  low: "bg-sky-950 text-sky-300 border-sky-800",
  info: "bg-slate-800 text-slate-400 border-slate-700",
};

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function CyberIncidentsPage() {
  const [incidents, setIncidents] = React.useState<Incident[] | null>(null);
  const [integrated, setIntegrated] = React.useState(true);
  const [reason, setReason] = React.useState("");
  const [filter, setFilter] = React.useState("active");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [err, setErr] = React.useState("");

  const load = React.useCallback(async () => {
    setErr("");
    const t = await token();
    if (!t) return setErr("Session expired. Sign in again.");
    try {
      const r = await fetch(`/api/cyber/incidents?status=${filter}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const j = await r.json();
      if (!j.ok) return setErr(j.error || "Could not load.");
      setIntegrated(j.integrated !== false);
      setReason(j.reason ?? "");
      setIncidents(j.incidents ?? []);
    } catch {
      setErr("Could not reach the security API.");
    }
  }, [filter]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Incidents</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            The timeline is append-only. Notes and status changes accumulate and
            cannot be edited or deleted — including by you.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by status"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          <option value="active">Active</option>
          <option value="all">All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {err && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {err}
        </p>
      )}

      {!incidents && !err && (
        <div className="grid h-32 place-items-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {incidents && !integrated && (
        <div className="rounded-2xl border border-dashed border-amber-900/60 bg-amber-950/20 p-6">
          <ShieldOff className="h-6 w-6 text-amber-500" />
          <p className="mt-3 font-semibold text-amber-200">Not integrated</p>
          <p className="mt-1 max-w-xl text-sm text-amber-200/70">{reason}</p>
        </div>
      )}

      {incidents && integrated && (
        <>
          <NewIncident onDone={load} />

          {incidents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 py-14 text-center">
              <Siren className="mx-auto h-8 w-8 text-slate-700" />
              <p className="mt-2 text-sm font-semibold text-slate-400">
                No incidents in this view
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Open one from a finding on the Threat Detection page, or start a blank one above.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map((i) => (
                <div key={i.id} className="rounded-2xl border border-slate-800 bg-slate-900/40">
                  <button
                    onClick={() => setSelected(selected === i.id ? null : i.id)}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <span className={cn(
                      "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                      SEV_STYLE[i.severity] ?? SEV_STYLE.info
                    )}>
                      {i.severity}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-100">{i.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {i.status} · opened {new Date(i.detected_at).toLocaleString("en-GB")}
                        {i.opened_by ? ` by ${i.opened_by}` : ""}
                        {i.detected_by_rule ? ` · rule ${i.detected_by_rule}` : ""}
                      </span>
                    </span>
                  </button>
                  {selected === i.id && <Timeline id={i.id} onChanged={load} />}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- new incident ---------------- */

function NewIncident({ onDone }: { onDone: () => void }) {
  const [show, setShow] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [severity, setSeverity] = React.useState("medium");
  const [summary, setSummary] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (title.trim().length < 4 || busy) return;
    setBusy(true);
    const t = await token();
    if (t) {
      await fetch("/api/cyber/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ action: "create", title, severity, summary }),
      });
    }
    setBusy(false);
    setTitle(""); setSummary(""); setShow(false);
    onDone();
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
      >
        <Plus className="h-3.5 w-3.5" /> Open an incident
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What happened? (required)"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
      />
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={3}
        placeholder="What you know so far. This becomes the first timeline entry and cannot be edited later."
        className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          aria-label="Severity"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none"
        >
          {["critical", "high", "medium", "low", "info"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={submit}
          disabled={busy || title.trim().length < 4}
          className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-900 disabled:opacity-40"
        >
          {busy ? "Opening…" : "Open incident"}
        </button>
        <button
          onClick={() => setShow(false)}
          className="text-xs font-semibold text-slate-500 hover:text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---------------- timeline ---------------- */

function Timeline({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [notes, setNotes] = React.useState<Note[] | null>(null);
  const [evidence, setEvidence] = React.useState<number>(0);
  const [body, setBody] = React.useState("");
  const [statusTo, setStatusTo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const t = await token();
    if (!t) return;
    const r = await fetch(`/api/cyber/incidents?id=${id}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    const j = await r.json();
    if (j.ok) {
      setNotes(j.notes ?? []);
      setEvidence((j.evidence ?? []).length);
    }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (body.trim().length < 2 || busy) return;
    setBusy(true);
    const t = await token();
    if (t) {
      await fetch("/api/cyber/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          action: "note",
          incidentId: id,
          body,
          statusTo: statusTo || undefined,
        }),
      });
    }
    setBusy(false);
    setBody(""); setStatusTo("");
    await load();
    onChanged();
  };

  return (
    <div className="space-y-4 border-t border-slate-800 px-4 py-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <Lock className="h-3 w-3" /> Append-only timeline
        {evidence > 0 && <span className="font-normal normal-case text-slate-600">· {evidence} events attached</span>}
      </p>

      {!notes ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
      ) : (
        <ol className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="border-l-2 border-slate-800 pl-3">
              <p className="text-xs text-slate-500">
                {new Date(n.created_at).toLocaleString("en-GB")} · {n.author_email}
                {n.status_to && (
                  <span className="ml-1 font-semibold text-slate-400">
                    {n.status_from ? `${n.status_from} → ${n.status_to}` : n.status_to}
                  </span>
                )}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-300">{n.body}</p>
            </li>
          ))}
        </ol>
      )}

      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add to the timeline. This cannot be edited or removed once saved."
          className="w-full resize-none bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusTo}
            onChange={(e) => setStatusTo(e.target.value)}
            aria-label="Change status"
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="">Note only — no status change</option>
            {STATUSES.map((s) => <option key={s} value={s}>Move to {s}</option>)}
          </select>
          <button
            onClick={submit}
            disabled={busy || body.trim().length < 2}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-900 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
