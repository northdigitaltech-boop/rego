"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import {
  ANSWER_TYPES,
  ANSWER_TYPE_LABELS,
  INTENTS,
  STATUS_LABELS,
  validateAnswer,
  canPublish,
  type AdminAnswer,
  type AnswerStatus,
  type AnswerType,
  type SourceRef,
  type Warning,
} from "@/lib/answers";
import type { LocationRow, ServiceCategoryRow } from "@/lib/markets";
import { cn } from "@/lib/utils";

/* ============================================================
 * Answer Optimization — admin.
 *
 * ---------------------------------------------------------------------------
 * NOTHING PUBLISHES ITSELF.
 *
 * Every answer starts as a draft. Publishing is a separate,
 * deliberate action, and the server re-runs the same validation
 * before allowing it — the warnings shown here are a courtesy,
 * not the gate.
 *
 * Blocking problems are shown in red and disable Publish.
 * Everything else is a warning the editor can overrule, because
 * most weak content is fixable and an editor who cannot see
 * why is stuck.
 * ---------------------------------------------------------------------------
 */

const STATUS_STYLES: Record<AnswerStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-gold/20 text-gold-700",
  published: "bg-forest-50 text-forest-600",
  needs_review: "bg-gold/20 text-gold-700",
  expired: "bg-red-50 text-red-600",
  archived: "bg-muted text-muted-foreground",
};

const EMPTY = {
  question: "",
  short_answer: "",
  detailed_answer: "",
  answer_type: "general" as AnswerType,
  intent: "",
  language_code: "en",
  service_slug: "",
  is_time_sensitive: false,
  valid_until: "",
  last_verified_at: "",
  display_order: 100,
  is_featured: false,
  source_references: [] as SourceRef[],
};

type Draft = typeof EMPTY;

async function post(body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Please sign in again." };
  const res = await fetch("/api/admin/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({ ok: false, error: "Bad response" }))) as {
    ok: boolean;
    error?: string;
    id?: string;
    warnings?: Warning[];
  };
}

export function AnswersManager({
  location,
  services,
}: {
  location: LocationRow;
  services: ServiceCategoryRow[];
}) {
  const [rows, setRows] = React.useState<AdminAnswer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft>({ ...EMPTY });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("answers")
      .select("*")
      .eq("location_id", location.id)
      .neq("status", "archived")
      .order("display_order")
      .order("created_at");
    setRows((data as AdminAnswer[]) ?? []);
    setLoading(false);
  }, [location.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const warnings = validateAnswer({
    question: draft.question,
    short_answer: draft.short_answer,
    detailed_answer: draft.detailed_answer,
    answer_type: draft.answer_type,
    is_time_sensitive: draft.is_time_sensitive,
    valid_until: draft.valid_until || null,
    last_verified_at: draft.last_verified_at || null,
    source_references: draft.source_references,
  });
  const blocked = !canPublish(warnings);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };

  const reset = () => {
    setDraft({ ...EMPTY });
    setEditing(null);
    setError("");
    setSaved(false);
  };

  const openRow = (r: AdminAnswer) => {
    setEditing(r.id);
    setSaved(false);
    setError("");
    setDraft({
      question: r.question,
      short_answer: r.short_answer,
      detailed_answer: r.detailed_answer ?? "",
      answer_type: r.answer_type,
      intent: r.intent ?? "",
      language_code: r.language_code,
      service_slug: r.service_slug ?? "",
      is_time_sensitive: r.is_time_sensitive,
      valid_until: r.valid_until?.slice(0, 10) ?? "",
      last_verified_at: r.last_verified_at?.slice(0, 10) ?? "",
      display_order: r.display_order,
      is_featured: r.is_featured,
      source_references: r.source_references ?? [],
    });
  };

  const save = async () => {
    setBusy(true);
    setError("");
    const r = await post({
      action: "save",
      id: editing,
      patch: {
        ...draft,
        location_id: location.id,
        entity_type: "destination",
        intent: draft.intent || null,
        service_slug: draft.service_slug || null,
        valid_until: draft.valid_until || null,
        last_verified_at: draft.last_verified_at || null,
        detailed_answer: draft.detailed_answer || null,
      },
    });
    if (!r.ok) setError(r.error || "Could not save.");
    else {
      setSaved(true);
      setEditing(r.id ?? editing);
      await load();
    }
    setBusy(false);
  };

  const transition = async (id: string, to: string) => {
    setBusy(true);
    setError("");
    const r = await post({ action: "transition", id, to });
    if (!r.ok) {
      const blocks = (r.warnings ?? []).map((w) => w.message).join(" ");
      setError(`${r.error ?? "Could not change status."} ${blocks}`.trim());
    }
    await load();
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Answers appear on <strong>/destinations/{location.slug}</strong> once published
        and once <code className="rounded bg-muted px-1">NEXT_PUBLIC_AEO_ENABLED=1</code> is
        set. Nothing publishes automatically.
      </p>

      {/* ---- Existing answers ---- */}
      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading answers…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          No answers for {location.name} yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => (
            <li key={r.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  onClick={() => openRow(r)}
                  className="min-w-0 flex-1 text-left font-medium text-forest hover:text-gold"
                >
                  {r.question}
                </button>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    STATUS_STYLES[r.status]
                  )}
                >
                  {STATUS_LABELS[r.status]}
                </span>
              </div>

              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {r.short_answer}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {ANSWER_TYPE_LABELS[r.answer_type]}
                </span>
                {r.is_time_sensitive && (
                  <span className="rounded bg-gold/20 px-1.5 py-0.5 font-medium text-gold-700">
                    Time-sensitive
                  </span>
                )}
                {(r.source_references ?? []).length === 0 && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                    No source
                  </span>
                )}

                <span className="ml-auto flex gap-2">
                  {r.status !== "published" && (
                    <button
                      disabled={busy}
                      onClick={() => transition(r.id, "publish")}
                      className="font-semibold text-forest hover:text-gold disabled:opacity-60"
                    >
                      Publish
                    </button>
                  )}
                  {r.status === "published" && (
                    <button
                      disabled={busy}
                      onClick={() => transition(r.id, "unpublish")}
                      className="font-semibold text-forest hover:text-gold disabled:opacity-60"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => transition(r.id, "archive")}
                    className="text-muted-foreground hover:text-red-600 disabled:opacity-60"
                  >
                    Archive
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ---- Editor ---- */}
      <div className="rounded-xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-display text-base font-bold text-forest">
            {editing ? "Edit answer" : "New answer"}
          </h4>
          {editing && (
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-forest">
              Start a new one
            </button>
          )}
        </div>

        <div className="space-y-3">
          <Field label="Traveller's question" hint="Write it the way a traveller would ask.">
            <input
              value={draft.question}
              onChange={(e) => set("question", e.target.value)}
              placeholder="What is the best time to visit Skardu?"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </Field>

          <Field
            label="Short answer"
            hint="One paragraph that answers the question on its own, including any important limits."
          >
            <textarea
              value={draft.short_answer}
              onChange={(e) => set("short_answer", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed"
            />
          </Field>

          <Field label="Supporting detail" hint="Optional. Never needed to understand the short answer.">
            <textarea
              value={draft.detailed_answer}
              onChange={(e) => set("detailed_answer", e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <select
                value={draft.answer_type}
                onChange={(e) => set("answer_type", e.target.value as AnswerType)}
                className="w-full rounded-lg border border-border bg-card px-2 py-2 text-sm"
              >
                {ANSWER_TYPES.map((t) => (
                  <option key={t} value={t}>{ANSWER_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="Intent">
              <select
                value={draft.intent}
                onChange={(e) => set("intent", e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="">—</option>
                {INTENTS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </Field>
            <Field label="Service" hint="Only if the answer is about one service.">
              <select
                value={draft.service_slug}
                onChange={(e) => set("service_slug", e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="">All services</option>
                {services.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <SourceEditor
            value={draft.source_references}
            onChange={(v) => set("source_references", v)}
          />

          <label className="flex items-start gap-2 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              checked={draft.is_time_sensitive}
              onChange={(e) => set("is_time_sensitive", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-forest-600"
            />
            <span>
              <span className="block text-sm font-semibold text-forest">Time-sensitive</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                Prices, road conditions, schedules, restrictions. Requires an expiry and a
                verification date — after expiry it moves to Needs review and stops showing.
              </span>
            </span>
          </label>

          {draft.is_time_sensitive && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Last verified">
                <input
                  type="date"
                  value={draft.last_verified_at}
                  onChange={(e) => set("last_verified_at", e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Expires">
                <input
                  type="date"
                  value={draft.valid_until}
                  onChange={(e) => set("valid_until", e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </Field>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Display order">
              <input
                type="number"
                value={draft.display_order}
                onChange={(e) => set("display_order", Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={draft.is_featured}
                onChange={(e) => set("is_featured", e.target.checked)}
                className="h-4 w-4 accent-forest-600"
              />
              <span className="text-sm text-foreground">
                Feature with its own heading
                <span className="block text-xs text-muted-foreground">
                  Max 3 per page — the rest go in the FAQ.
                </span>
              </span>
            </label>
          </div>

          {/* ---- Warnings ---- */}
          {warnings.length > 0 && (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs leading-relaxed",
                    w.level === "block"
                      ? "bg-red-50 text-red-700"
                      : "bg-gold/10 text-forest"
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={save}
              disabled={busy || !draft.question.trim() || !draft.short_answer.trim()}
              className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Save as draft"}
            </button>

            {editing && (
              <button
                onClick={() => transition(editing, "publish")}
                disabled={busy || blocked}
                title={blocked ? "Fix the red items first." : undefined}
                className="rounded-lg border border-forest-600 px-4 py-2 text-sm font-semibold text-forest hover:bg-forest-50 disabled:opacity-50"
              >
                Publish
              </button>
            )}

            {saved && (
              <span className="flex items-center gap-1 text-sm font-medium text-forest-600">
                <CheckCircle2 className="h-4 w-4" /> Saved as draft
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SourceEditor({
  value,
  onChange,
}: {
  value: SourceRef[];
  onChange: (v: SourceRef[]) => void;
}) {
  const update = (i: number, patch: Partial<SourceRef>) =>
    onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-semibold text-forest">Sources</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        Required for prices, distances, timings and anything time-sensitive. A fact a
        reader cannot check is an assertion.
      </p>

      <div className="mt-2 space-y-2">
        {value.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={s.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label"
              className="w-1/3 rounded border border-border bg-card px-2 py-1.5 text-xs"
            />
            <input
              value={s.url}
              onChange={(e) => update(i, { url: e.target.value })}
              placeholder="https://…"
              className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs"
            />
            <button
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="rounded p-1.5 text-red-600 hover:bg-red-50"
              aria-label="Remove source"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {value.length < 10 && (
        <button
          onClick={() => onChange([...value, { label: "", url: "" }])}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-forest hover:text-gold"
        >
          <Plus className="h-3 w-3" /> Add source
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
