"use client";

import * as React from "react";
import {
  Loader2, ShieldOff, Power, Ban, UserX, Undo2, Info, AlertTriangle, CheckCircle2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { ENFORCED_ROUTES } from "@/lib/enforced-routes";

interface ActionRow {
  id: string;
  action: string;
  target_kind: string;
  target: string;
  actor_email: string;
  reason: string;
  duration_h: number | null;
  expires_at: string | null;
  created_at: string;
}

interface ActiveBlock {
  ip: string;
  blocked_until: string;
  blocked_reason: string | null;
}

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function CyberEmergencyPage() {
  const [actions, setActions] = React.useState<ActionRow[] | null>(null);
  const [blocks, setBlocks] = React.useState<ActiveBlock[]>([]);
  const [integrated, setIntegrated] = React.useState(true);
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const load = React.useCallback(async () => {
    setErr("");
    const t = await token();
    if (!t) return setErr("Session expired. Sign in again.");
    try {
      const r = await fetch("/api/cyber/contain", { headers: { Authorization: `Bearer ${t}` } });
      const j = await r.json();
      if (!j.ok) return setErr(j.error || "Could not load.");
      setIntegrated(j.integrated !== false);
      setReason(j.reason ?? "");
      setActions(j.actions ?? []);
      setBlocks(j.activeBlocks ?? []);
    } catch {
      setErr("Could not reach the security API.");
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Emergency Controls</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Reversible, time-limited containment. Nothing here deletes data or
          changes a permission.
        </p>
      </div>

      {/* Scope statement first. Someone reaching this page during an
          incident needs to know the limits BEFORE they rely on it. */}
      <div className="flex gap-3 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="space-y-2 text-xs leading-relaxed text-amber-200/80">
          <p className="font-bold text-amber-200">What these controls do not do</p>
          <ul className="space-y-1">
            <li>• <strong>IP blocks only apply to the {ENFORCED_ROUTES.length} API routes listed below.</strong> Page loads and other routes are unaffected.</li>
            <li>• A blocked address can return via a phone hotspot or VPN in seconds. This slows an attacker; it does not stop one.</li>
            <li>• Changes take up to 60 seconds to reach every server instance.</li>
            <li>• If the database is unreachable, blocking silently stops working — it fails open so a lookup timeout cannot take your site down.</li>
            <li>• Admin accounts cannot be banned here. Do that deliberately in Supabase.</li>
          </ul>
        </div>
      </div>

      {err && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">{err}</p>
      )}
      {msg && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />{msg}
        </p>
      )}

      {!actions && !err && (
        <div className="grid h-32 place-items-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {actions && !integrated && (
        <div className="rounded-2xl border border-dashed border-amber-900/60 bg-amber-950/20 p-6">
          <ShieldOff className="h-6 w-6 text-amber-500" />
          <p className="mt-3 font-semibold text-amber-200">Not integrated</p>
          <p className="mt-1 max-w-xl text-sm text-amber-200/70">{reason}</p>
        </div>
      )}

      {actions && integrated && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ActionCard
              icon={<Ban className="h-4 w-4" />}
              title="Block an IP address"
              placeholder="203.0.113.45"
              actionOn="block_ip"
              actionOff="unblock_ip"
              onDone={(m) => { setMsg(m); load(); }}
              onError={setErr}
            />
            <ActionCard
              icon={<UserX className="h-4 w-4" />}
              title="Ban an account"
              placeholder="person@example.com"
              actionOn="ban_user"
              actionOff="unban_user"
              note="Existing sessions are rejected on their next request."
              onDone={(m) => { setMsg(m); load(); }}
              onError={setErr}
            />
          </div>

          {blocks.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Blocks in force ({blocks.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {blocks.map((b) => (
                  <li key={b.ip} className="text-xs text-slate-400">
                    <span className="font-mono text-slate-200">{b.ip}</span>
                    {" — until "}{new Date(b.blocked_until).toLocaleString()}
                    {b.blocked_reason && <span className="text-slate-600"> · {b.blocked_reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Info className="h-3.5 w-3.5" /> Routes that enforce IP blocks
            </p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {ENFORCED_ROUTES.map((r) => (
                <li key={r} className="font-mono text-[11px] text-slate-500">{r}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-600">
              Any route not on this list ignores blocks entirely.
            </p>
          </div>

          {/* Append-only history. */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Containment history
            </p>
            {actions.length === 0 ? (
              <div className="mt-2 rounded-2xl border border-dashed border-slate-800 py-10 text-center">
                <Power className="mx-auto h-7 w-7 text-slate-700" />
                <p className="mt-2 text-xs text-slate-500">No containment action has ever been taken.</p>
              </div>
            ) : (
              <ol className="mt-2 space-y-2">
                {actions.map((a) => (
                  <li key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-sm text-slate-200">
                      <span className="font-semibold">{a.action}</span>
                      {" → "}
                      <span className="font-mono text-xs">{a.target}</span>
                      {a.duration_h ? <span className="text-slate-500"> · {a.duration_h}h</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {new Date(a.created_at).toLocaleString()} · {a.actor_email}
                    </p>
                    <p className="mt-1 text-xs italic text-slate-400">{a.reason}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ActionCard({
  icon, title, placeholder, actionOn, actionOff, note, onDone, onError,
}: {
  icon: React.ReactNode;
  title: string;
  placeholder: string;
  actionOn: string;
  actionOff: string;
  note?: string;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [target, setTarget] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [hours, setHours] = React.useState(24);
  const [busy, setBusy] = React.useState("");

  const run = async (action: string) => {
    if (!target.trim() || reason.trim().length < 10 || busy) return;
    setBusy(action);
    const t = await token();
    if (t) {
      try {
        const r = await fetch("/api/cyber/contain", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ action, target: target.trim(), reason: reason.trim(), hours }),
        });
        const j = await r.json();
        if (j.ok) { onDone(j.message ?? "Done."); setTarget(""); setReason(""); }
        else onError(j.error || "Could not apply.");
      } catch {
        onError("Could not reach the security API.");
      }
    }
    setBusy("");
  };

  const ready = target.trim().length > 0 && reason.trim().length >= 10;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-slate-200">{icon}{title}</p>

      <input
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
      />
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Why? (required, min 10 characters — this is the permanent record)"
        className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          aria-label="Duration"
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
        >
          <option value={1}>1 hour</option>
          <option value={24}>24 hours</option>
          <option value={72}>3 days</option>
          <option value={168}>7 days (max)</option>
        </select>
        <button
          onClick={() => run(actionOn)}
          disabled={!ready || !!busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-900/80 px-3 py-1.5 text-xs font-bold text-red-100 hover:bg-red-900 disabled:opacity-40"
        >
          {busy === actionOn ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
          Apply
        </button>
        <button
          onClick={() => run(actionOff)}
          disabled={!ready || !!busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        >
          {busy === actionOff ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
          Lift
        </button>
      </div>

      <p className="text-[11px] text-slate-600">
        Expires automatically. {note}
      </p>
    </div>
  );
}
