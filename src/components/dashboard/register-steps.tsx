"use client";

import * as React from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/* ============================================================
 * The shell for a stepped registration.
 *
 * Ten provider dashboards will each need one of these. The
 * shape is identical in every case — a progress bar, one step
 * visible, Back and Continue, and a final submit that can fail
 * — so it lives here and each dashboard supplies only its own
 * fields and its own save.
 *
 * STEPS FOR REGISTERING, NOT FOR EDITING
 *   This is used the first time and never again. Someone who
 *   comes back next month to change one price wants that price
 *   on screen, not three clicks away; the folded form does
 *   that. Two different jobs, two different layouts, and
 *   conflating them makes the common one worse to improve the
 *   rare one.
 *
 * NOTHING IS SAVED UNTIL THE END
 *   A half-created provider with no service is a row an admin
 *   has to look at and cannot approve. So the steps only
 *   collect; the last one writes. The cost is that closing the
 *   tab loses the work — which is why there are three short
 *   steps and not eight.
 * ============================================================ */

export interface RegisterStep {
  /** Shown in the progress bar and as the heading. */
  title: string;
  /** One line under the heading, saying what this step is for. */
  hint?: string;
  content: React.ReactNode;
  /**
   * Returns an error to show, or null to continue.
   *
   * Runs on Continue rather than on every keystroke: telling someone their
   * name is missing while they are still typing it is not help.
   */
  validate?: () => string | null;
  /**
   * Wording for a "skip" control, on steps that ask for nothing required.
   *
   * A skippable step needs to say so on the button, not only in the text.
   * Someone looking at a request for their ID card decides in about a second
   * whether this is a wall; "Skip for now" next to Continue is what tells
   * them it is not.
   */
  skipLabel?: string;
}

export function RegisterSteps({
  heading,
  steps,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: {
  heading: string;
  steps: RegisterStep[];
  submitLabel: string;
  submitting: boolean;
  error?: string;
  onSubmit: () => void;
}) {
  const [i, setI] = React.useState(0);
  const [stepError, setStepError] = React.useState("");
  const last = i === steps.length - 1;
  const step = steps[i];

  const next = () => {
    const problem = step.validate?.() ?? null;
    if (problem) {
      setStepError(problem);
      return;
    }
    setStepError("");
    if (last) {
      onSubmit();
      return;
    }
    setI((n) => n + 1);
    /* Back to the top: on a phone the next step's heading would otherwise
       start below the fold, and it looks like nothing happened. */
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setStepError("");
    setI((n) => Math.max(0, n - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8">
      <h2 className="font-display text-xl font-bold text-forest">{heading}</h2>

      {/* One bar per step. Past steps stay filled, so the bar reads as
          progress rather than as a position. */}
      <div className="mt-4 flex gap-1.5" aria-hidden="true">
        {steps.map((s, k) => (
          <span
            key={s.title}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              k <= i ? "bg-forest-600" : "bg-border"
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">
        Step {i + 1} of {steps.length}
      </p>

      <div className="mt-6">
        <h3 className="font-display text-lg font-bold text-forest">
          {step.title}
        </h3>
        {step.hint && (
          <p className="mt-1 text-sm text-muted-foreground">{step.hint}</p>
        )}
        <div className="mt-4 space-y-4">{step.content}</div>
      </div>

      {(stepError || error) && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {stepError || error}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {i > 0 ? (
          <button
            type="button"
            onClick={back}
            disabled={submitting}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-forest hover:bg-muted disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <span />
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Skip sits beside Continue rather than under it. A step that
              asks for an ID card is judged in about a second; the way out
              has to be visible in that second or the answer is to close
              the tab. */}
          {step.skipLabel && !last && (
            <button
              type="button"
              onClick={() => {
                setStepError("");
                setI((n) => n + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={submitting}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-forest hover:underline disabled:opacity-50"
            >
              {step.skipLabel}
            </button>
          )}

          <button
            type="button"
            onClick={next}
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-forest px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {last ? (submitting ? "Submitting…" : submitLabel) : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The screen after a successful registration.
 *
 * Says what happens next in plain terms. A provider who has just filled in
 * a form and sees only "Saved" does not know whether they are live, whether
 * anyone is looking, or whether they should wait — and the honest answer to
 * all three is worth two sentences.
 */
export function RegisteredNotice({
  what,
  onContinue,
}: {
  /** e.g. "transport business" */
  what: string;
  onContinue: () => void;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-8 text-center shadow-premium">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest-50">
        <Check className="h-7 w-7 text-forest-600" />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold text-forest">
        Your {what} has been submitted
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        The Rego team reviews new listings before they go live. You will get an
        email when yours is approved. In the meantime you can add more services,
        photos and details from your dashboard — none of it has to wait.
      </p>
      <button
        onClick={onContinue}
        className="mt-6 rounded-xl bg-gradient-forest px-6 py-2.5 text-sm font-semibold text-white shadow-soft"
      >
        Go to my dashboard
      </button>
    </div>
  );
}
