"use client";

import * as React from "react";
import { Save, RotateCcw, Plus, Trash2, Check, Loader2, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getLegalPolicies,
  saveLegalPolicies,
  legalPolicies as defaultLegalPolicies,
  type LegalPolicy,
} from "@/lib/legal";

/* ---------------- small field helpers ---------------- */
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="auth-input" />
    </label>
  );
}
function Area({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className="auth-input resize-y" />
    </label>
  );
}
function ParaList({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <textarea value={it} rows={2} onChange={(e) => set(i, e.target.value)} className="auth-input resize-y" />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-red-500 hover:bg-red-50"
              aria-label="Remove paragraph"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest-600 hover:text-gold"
      >
        <Plus className="h-3.5 w-3.5" /> Add paragraph
      </button>
    </div>
  );
}

export function AdminLegal() {
  const [policies, setPolicies] = React.useState<LegalPolicy[] | null>(null);
  const [activeSlug, setActiveSlug] = React.useState<string>(defaultLegalPolicies[0].slug);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");

  React.useEffect(() => {
    getLegalPolicies().then(setPolicies);
  }, []);

  const patchActive = (fn: (p: LegalPolicy) => void) =>
    setPolicies((prev) => {
      if (!prev) return prev;
      return prev.map((p) => {
        if (p.slug !== activeSlug) return p;
        const n: LegalPolicy = structuredClone(p);
        fn(n);
        return n;
      });
    });

  const save = async () => {
    if (!policies) return;
    setStatus("saving");
    const { error } = await saveLegalPolicies(policies);
    setStatus(error ? "error" : "saved");
    if (!error) setTimeout(() => setStatus("idle"), 2500);
  };

  const restoreActive = () => {
    const def = defaultLegalPolicies.find((p) => p.slug === activeSlug);
    if (!def) return;
    setPolicies((prev) => (prev ? prev.map((p) => (p.slug === activeSlug ? structuredClone(def) : p)) : prev));
  };

  if (!policies) {
    return (
      <div className="grid h-40 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const active = policies.find((p) => p.slug === activeSlug) ?? policies[0];

  return (
    <div className="space-y-5">
      {/* Header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">Legal &amp; Policies</h2>
          <p className="text-sm text-muted-foreground">
            Edit the public policy pages. Changes go live within a minute.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status === "saved" && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
          {status === "error" && <span className="text-sm font-semibold text-red-600">Save failed</span>}
          <Button variant="gold" onClick={save} disabled={status === "saving"}>
            {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Pick a policy, edit its heading text and paragraphs, then Save. Placeholders in square brackets (e.g. [LEGAL ENTITY NAME]) should be replaced with your real details. Have a lawyer review the final wording.
      </p>

      {/* Policy selector */}
      <div className="flex flex-wrap gap-2">
        {policies.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setActiveSlug(p.slug)}
            className={
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors " +
              (p.slug === activeSlug
                ? "border-forest-600 bg-forest-600 text-white"
                : "border-border bg-card text-forest hover:border-forest-600")
            }
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Active policy editor */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-forest">
            {active.title}
          </h3>
          <Button variant="outline" onClick={restoreActive}>
            <RotateCcw className="h-4 w-4" /> Restore this policy
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Title" value={active.title} onChange={(v) => patchActive((p) => { p.title = v; })} />
          <Area label="Short summary (shown on cards)" value={active.summary} onChange={(v) => patchActive((p) => { p.summary = v; })} />
          <ParaList label="Intro paragraphs" items={active.intro} onChange={(v) => patchActive((p) => { p.intro = v; })} />
        </div>

        <div className="mt-6 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-forest">Sections</h4>
          {active.sections.map((section, si) => (
            <div key={si} className="rounded-xl border border-border/60 bg-muted/40 p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Field
                    label={`Section ${si + 1} heading`}
                    value={section.heading ?? ""}
                    onChange={(v) => patchActive((p) => { p.sections[si].heading = v; })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => patchActive((p) => { p.sections.splice(si, 1); })}
                  className="mt-6 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-red-500 hover:bg-red-50"
                  aria-label="Remove section"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2">
                <ParaList
                  label="Paragraphs"
                  items={section.body}
                  onChange={(v) => patchActive((p) => { p.sections[si].body = v; })}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patchActive((p) => { p.sections.push({ heading: "", body: [""] }); })}
            className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold"
          >
            <Plus className="h-4 w-4" /> Add section
          </button>
        </div>
      </section>

      {/* Sticky save at bottom */}
      <div className="flex justify-end">
        <Button variant="gold" onClick={save} disabled={status === "saving"}>
          {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
        </Button>
      </div>
    </div>
  );
}
