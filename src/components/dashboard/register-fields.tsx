"use client";

import * as React from "react";

import { readReferral, rememberTypedReferral } from "@/lib/referral";

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

/* ============================================================
 * "Who told you about Rego?" — the referral code, typed.
 *
 * WHY IT WRITES TO LOCALSTORAGE AND NOT TO A PROP
 *   Every wizard already calls attachStashedReferral() after the listing is
 *   created, and that reads the stash. So this field needs no state in the
 *   nine wizards and no change to any of their submit functions: it stores
 *   the code where the existing plumbing already looks.
 *
 *   That also means it works the same as a ?ref= link, which is the point —
 *   somebody handed a printed card and somebody sent a link should end up
 *   credited identically.
 *
 * TYPING BEATS A LINK, ON PURPOSE
 *   rememberTypedReferral REPLACES a stashed link. A link is passive; typing
 *   a code is a person telling us who actually sent them, and they get the
 *   last word.
 *
 * NOTHING HERE IS TRUSTED. attach_referral() resolves the code in the
 * database, refuses an unknown or suspended one, and refuses to overwrite an
 * existing referral.
 * ============================================================ */
export function ReferralField() {
  const [code, setCode] = React.useState("");
  const [state, setState] = React.useState<"idle" | "kept" | "bad">("idle");

  /* Prefilled when they arrived through a link, so somebody who followed
     MKT-005 does not have to be told their own code. Read once, on mount. */
  React.useEffect(() => {
    const existing = readReferral();
    if (existing) {
      setCode(existing);
      setState("kept");
    }
  }, []);

  const remember = (raw: string) => {
    setCode(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      setState("idle");
      return;
    }
    setState(rememberTypedReferral(trimmed) ? "kept" : "bad");
  };

  return (
    <L label="Referral code">
      <input
        value={code}
        onChange={(e) => remember(e.target.value)}
        className="auth-input"
        placeholder="e.g. MKT-005"
        autoComplete="off"
      />
      <span className="mt-1 block text-xs text-muted-foreground">
        {state === "bad"
          ? "That does not look like a Rego code — check it, or leave it blank."
          : state === "kept"
            ? "Saved. The Rego team member who gave you this will be credited."
            : "If a Rego team member introduced you, enter their code so they are credited. Optional."}
      </span>
    </L>
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
