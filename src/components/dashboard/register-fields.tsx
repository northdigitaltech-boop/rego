"use client";

import * as React from "react";

/* ============================================================
 * The small pieces every registration wizard uses.
 *
 * Pulled out of transport-register.tsx once a second wizard
 * needed them. Nothing here is clever — it exists so that four
 * wizards do not each carry their own label component that
 * drifts a little from the others.
 * ============================================================ */

export function L({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-forest">
        {label} {required && <span className="text-gold-600">*</span>}
      </span>
      {children}
    </label>
  );
}

export function Summary({
  heading,
  rows,
}: {
  heading: string;
  rows: [string, string][];
}) {
  /* Blank answers are skipped rather than shown as dashes. A review screen
     listing six empty fields reads as a list of things you got wrong. */
  const filled = rows.filter(([, v]) => v.trim());
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4">
      <p className="font-display text-sm font-bold text-forest">{heading}</p>
      {filled.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Nothing added yet.</p>
      ) : (
        <dl className="mt-2 space-y-1 text-sm">
          {filled.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">{k}:</dt>
              <dd className="min-w-0 break-words font-medium text-forest">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** The two paragraphs that close every review step. */
export function ReviewFooter({
  verification,
}: {
  /** From verificationSummary(). */
  verification: string;
}) {
  return (
    <>
      <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-forest">
        <strong>Verification:</strong> {verification}
      </p>
      <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-forest">
        The Rego team checks new listings before they go live. You can keep
        adding details while yours is being reviewed.
      </p>
    </>
  );
}

/**
 * Turns a comma-separated box into the string[] these tables store.
 *
 * Several provider tables keep languages, areas and specialities as arrays,
 * and every existing form splits the text itself. Doing it in one place
 * means the trimming and the empty-entry handling match everywhere.
 */
export function toList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
