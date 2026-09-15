"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { explainMarkup, type MarkupRule } from "@/lib/flights/markup";
import { formatMoney } from "@/lib/flights/format";
import type { CabinClass } from "@/lib/flights/types";

/* ============================================================
 * Flight markup rules.
 *
 * WHY THE PREVIEW IS NOT OPTIONAL
 *   The rules in the brief all match one flight at once — 2% on
 *   everything, 3% on PIA, PKR 3,000 international, PKR 5,000 on
 *   the route, 4% business. The engine applies ONE percentage and
 *   ONE fixed amount, chosen by priority then specificity, because
 *   stacking them turns an PKR 85,000 fare into PKR 96,000.
 *
 *   That is the right behaviour and it is invisible. Without a
 *   preview, an admin adds a 5% rule, nothing changes, and they
 *   add another. So the preview shows which rules WON, which
 *   matched and lost, and the resulting total — the same
 *   explainMarkup() the pricing path uses, not a reimplementation.
 * ============================================================ */

interface RuleRow {
  id: string;
  scope: string;
  match_value: string | null;
  kind: string;
  value: number;
  currency: string | null;
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  label: string | null;
}

const toRule = (r: RuleRow): MarkupRule => ({
  id: r.id,
  scope: r.scope as MarkupRule["scope"],
  matchValue: r.match_value,
  kind: r.kind as MarkupRule["kind"],
  value: Number(r.value),
  currency: r.currency,
  priority: r.priority,
  isActive: r.is_active,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  label: r.label,
});

const SCOPES = [
  { id: "all", label: "All flights" },
  { id: "airline", label: "Airline" },
  { id: "route", label: "Route" },
  { id: "international", label: "International" },
  { id: "domestic", label: "Domestic" },
  { id: "cabin", label: "Cabin" },
  { id: "provider", label: "Provider" },
] as const;

const NEEDS_TARGET = new Set(["airline", "route", "cabin", "provider"]);

const emptyForm = {
  id: "",
  scope: "all",
  matchValue: "",
  kind: "percent",
  value: "",
  currency: "PKR",
  priority: "0",
  label: "",
  isActive: true,
};

export function AdminFlightMarkup() {
  const [rules, setRules] = React.useState<MarkupRule[] | null>(null);
  const [form, setForm] = React.useState({ ...emptyForm });
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  const load = React.useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRules([]);
      return;
    }
    const { data } = await supabase
      .from("flight_markup_rules")
      .select("*")
      .order("priority", { ascending: false });
    setRules(((data as RuleRow[]) ?? []).map(toRule));
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setNote(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token ?? "";

      const res = await fetch("/api/admin/flight-markup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };

      if (!json.ok) {
        setNote({ ok: false, text: json.error ?? "That did not save." });
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await post({
      action: "save",
      id: form.id || undefined,
      scope: form.scope,
      matchValue: NEEDS_TARGET.has(form.scope) ? form.matchValue : null,
      kind: form.kind,
      value: Number(form.value),
      currency: form.currency,
      priority: Number(form.priority),
      label: form.label,
      isActive: form.isActive,
    });
    if (ok) {
      setForm({ ...emptyForm });
      setNote({ ok: true, text: "Rule saved." });
    }
  };

  const edit = (r: MarkupRule) =>
    setForm({
      id: r.id,
      scope: r.scope,
      matchValue: r.matchValue ?? "",
      kind: r.kind,
      /* Fixed amounts are stored in minor units and edited in major. */
      value: r.kind === "fixed" ? String(r.value / 100) : String(r.value),
      currency: r.currency ?? "PKR",
      priority: String(r.priority),
      label: r.label ?? "",
      isActive: r.isActive,
    });

  if (rules === null) {
    return (
      <div className="grid h-40 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-forest-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-forest">Flight markup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What Rego adds to the airline&apos;s fare. The provider price is never
          changed — markup is stored separately, so every total can be explained.
        </p>
      </div>

      {note && (
        <p
          className={
            note.ok
              ? "rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-700"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {note.text}
        </p>
      )}

      {rules.length === 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          No rules yet, which means zero markup — customers currently see the
          airline fare with nothing added.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ---- rules ---- */}
        <div className="space-y-3">
          {rules.map((r) => (
            <div
              key={r.id}
              className={cn(
                "rounded-2xl border bg-card p-4",
                r.isActive ? "border-border" : "border-dashed border-border opacity-60"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-forest">
                    {r.label || describeRule(r)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {describeRule(r)} · priority {r.priority}
                    {!r.isActive && " · inactive"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      post({ action: "set_active", id: r.id, isActive: !r.isActive })
                    }
                    disabled={busy}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-forest hover:bg-muted"
                  >
                    {r.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => edit(r)}
                    aria-label="Edit rule"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border text-forest hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => post({ action: "delete", id: r.id })}
                    disabled={busy}
                    aria-label="Delete rule"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ---- form + preview ---- */}
        <div className="space-y-5">
          <form
            onSubmit={save}
            className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium"
          >
            <p className="font-display text-base font-bold text-forest">
              {form.id ? "Edit rule" : "New rule"}
            </p>

            <div className="mt-3 space-y-3">
              <Field label="Applies to">
                <select
                  value={form.scope}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scope: e.target.value, matchValue: "" }))
                  }
                  className="auth-input"
                >
                  {SCOPES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>

              {NEEDS_TARGET.has(form.scope) && (
                <Field
                  label={
                    form.scope === "airline"
                      ? "Airline code"
                      : form.scope === "route"
                        ? "Route"
                        : form.scope === "cabin"
                          ? "Cabin"
                          : "Provider"
                  }
                >
                  {form.scope === "cabin" ? (
                    <select
                      value={form.matchValue}
                      onChange={(e) => setForm((f) => ({ ...f, matchValue: e.target.value }))}
                      className="auth-input"
                    >
                      <option value="">Choose…</option>
                      <option value="economy">Economy</option>
                      <option value="premium_economy">Premium Economy</option>
                      <option value="business">Business</option>
                      <option value="first">First</option>
                    </select>
                  ) : (
                    <input
                      value={form.matchValue}
                      onChange={(e) => setForm((f) => ({ ...f, matchValue: e.target.value }))}
                      placeholder={form.scope === "route" ? "KUL-ISB" : "PK"}
                      className="auth-input"
                    />
                  )}
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select
                    value={form.kind}
                    onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                    className="auth-input"
                  >
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </Field>
                <Field label={form.kind === "percent" ? "Percent" : "Amount (PKR)"}>
                  <input
                    type="number"
                    step={form.kind === "percent" ? "0.1" : "1"}
                    min="0"
                    max={form.kind === "percent" ? "100" : undefined}
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    className="auth-input"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    className="auth-input"
                  />
                </Field>
                <Field label="Name (optional)">
                  <input
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Summer PIA"
                    className="auth-input"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-forest px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {form.id ? "Save changes" : "Add rule"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={() => setForm({ ...emptyForm })}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-forest hover:bg-muted"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <Preview rules={rules} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function describeRule(r: MarkupRule): string {
  const amount =
    r.kind === "percent"
      ? `${r.value}%`
      : formatMoney({ amount: r.value, currency: r.currency ?? "PKR" });

  switch (r.scope) {
    case "all":
      return `${amount} on all flights`;
    case "airline":
      return `${amount} on ${r.matchValue}`;
    case "route":
      return `${amount} on ${r.matchValue}`;
    case "international":
      return `${amount} on international flights`;
    case "domestic":
      return `${amount} on domestic flights`;
    case "cabin":
      return `${amount} on ${r.matchValue?.replace("_", " ")}`;
    case "provider":
      return `${amount} via ${r.matchValue}`;
    default:
      return amount;
  }
}

/**
 * The preview.
 *
 * Uses explainMarkup() — the same function the pricing path uses — against a
 * sample fare the admin can change. Reimplementing the arithmetic here would
 * mean the preview and the real price could disagree, which is the one thing
 * a preview must never do.
 */
function Preview({ rules }: { rules: MarkupRule[] }) {
  const [base, setBase] = React.useState("85000");
  const [carrier, setCarrier] = React.useState("PK");
  const [origin, setOrigin] = React.useState("KUL");
  const [destination, setDestination] = React.useState("ISB");
  const [cabin, setCabin] = React.useState<CabinClass>("business");

  const baseMinor = Math.round((Number(base) || 0) * 100);
  const taxMinor = Math.round(baseMinor * 0.18);

  const result = explainMarkup(
    {
      baseFare: { amount: baseMinor, currency: "PKR" },
      tax: { amount: taxMinor, currency: "PKR" },
      total: { amount: baseMinor + taxMinor, currency: "PKR" },
    },
    rules,
    {
      validatingCarrierCode: carrier.toUpperCase(),
      originCode: origin.toUpperCase(),
      destinationCode: destination.toUpperCase(),
      /* A rough country guess is enough for a preview — the real path reads
         the offer's own airports. */
      originCountryCode: origin.toUpperCase() === "KUL" ? "MY" : "PK",
      destinationCountryCode: destination.toUpperCase() === "KUL" ? "MY" : "PK",
      cabin,
      providerId: "mock",
      now: new Date().toISOString(),
    }
  );

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
      <p className="font-display text-base font-bold text-forest">Preview</p>
      <p className="mt-1 text-xs text-muted-foreground">
        What these rules would do to one fare.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Base fare (PKR)">
          <input
            type="number"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="auth-input"
          />
        </Field>
        <Field label="Airline">
          <input
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="auth-input"
          />
        </Field>
        <Field label="From">
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="auth-input"
          />
        </Field>
        <Field label="To">
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="auth-input"
          />
        </Field>
      </div>

      <Field label="Cabin">
        <select
          value={cabin}
          onChange={(e) => setCabin(e.target.value as CabinClass)}
          className="auth-input"
        >
          <option value="economy">Economy</option>
          <option value="premium_economy">Premium Economy</option>
          <option value="business">Business</option>
          <option value="first">First</option>
        </select>
      </Field>

      <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
        <Line label="Airline fare + tax" value={formatMoney({ amount: baseMinor + taxMinor, currency: "PKR" })} />
        <Line label="Rego markup" value={formatMoney(result.result.markup)} />
        <Line label="Customer pays" value={formatMoney(result.customerTotal)} strong />
      </dl>

      {result.applied.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-forest-600">
            Applied
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-forest">
            {result.applied.map((r) => (
              <li key={r.id}>✓ {r.label || describeRule(r)}</li>
            ))}
          </ul>
        </div>
      )}

      {result.matchedButUnused.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Matched but not applied
          </p>
          {/* The whole reason this panel exists. These rules fit the flight
              and lost on priority or specificity — without saying so, an
              admin sees "nothing happened" and adds another rule. */}
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {result.matchedButUnused.map((r) => (
              <li key={r.id}>— {r.label || describeRule(r)}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            One percentage and one fixed amount apply at most, chosen by
            priority then by how specific the rule is. They do not stack.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className={strong ? "font-semibold text-forest" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd className={strong ? "font-display text-lg font-bold text-forest" : "text-forest"}>
        {value}
      </dd>
    </div>
  );
}
