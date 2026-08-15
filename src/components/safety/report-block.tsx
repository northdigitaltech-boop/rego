"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Flag, Ban, X, Loader2, ShieldAlert, CheckCircle2, MoreHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { useScrollLock } from "@/lib/use-scroll-lock";
import {
  submitReport, blockUser, REPORT_REASONS, type ReportTargetType,
} from "@/lib/safety";
import { cn } from "@/lib/utils";

/**
 * Report / block control. Drop it on any profile, story or listing.
 *
 * Deliberately understated — a prominent "REPORT" button makes a marketplace
 * feel dangerous. It sits behind a quiet "…" menu, but is always reachable.
 */
export function ReportBlock({
  targetType,
  targetId,
  targetEmail,
  targetName,
  /** Blocking only makes sense for people, not listings. */
  allowBlock = true,
  className,
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetEmail?: string | null;
  targetName?: string;
  allowBlock?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [mode, setMode] = React.useState<null | "report" | "block">(null);

  // Never offer these on your own profile.
  const isSelf =
    !!user?.email &&
    !!targetEmail &&
    user.email.toLowerCase() === targetEmail.toLowerCase();
  if (isSelf) return null;

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More options"
          aria-expanded={menuOpen}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-forest"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-premium-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setMode("report");
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-forest hover:bg-muted"
              >
                <Flag className="h-4 w-4" /> Report
              </button>
              {allowBlock && targetEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setMode("block");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Ban className="h-4 w-4" /> Block
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {mode && (
        <SafetyDialog
          mode={mode}
          onClose={() => setMode(null)}
          targetType={targetType}
          targetId={targetId}
          targetEmail={targetEmail}
          targetName={targetName}
        />
      )}
    </>
  );
}

/* ---------------- dialog ---------------- */

function SafetyDialog({
  mode,
  onClose,
  targetType,
  targetId,
  targetEmail,
  targetName,
}: {
  mode: "report" | "block";
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetEmail?: string | null;
  targetName?: string;
}) {
  const { user } = useAuth();
  const [reason, setReason] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  useScrollLock(true);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const who = targetName || "this account";

  const submit = async () => {
    setError("");
    if (!user?.email) {
      setError("Please sign in first.");
      return;
    }
    if (mode === "report" && !reason) {
      setError("Please choose a reason.");
      return;
    }

    setBusy(true);
    const r =
      mode === "report"
        ? await submitReport({
            reporterEmail: user.email,
            targetType,
            targetId,
            targetEmail,
            reason,
            details,
          })
        : await blockUser(user.email, targetEmail ?? "", details);
    setBusy(false);

    if (!r.ok) {
      setError(r.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-forest-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-premium-lg sm:max-w-md sm:rounded-3xl sm:p-6"
      >
        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-forest-600" />
            <h2 className="mt-3 font-display text-xl font-bold text-forest">
              {mode === "report" ? "Thanks for telling us" : "Blocked"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {mode === "report"
                ? "Our team will review this. We won't tell them who reported it, and we may contact you if we need more detail."
                : `${who} can no longer connect with you or see your profile. They aren't told about this.`}
            </p>
            <Button variant="gold" className="mt-5 w-full rounded-lg" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-2xl",
                    mode === "report"
                      ? "bg-gold/15 text-gold-700"
                      : "bg-red-50 text-red-600"
                  )}
                >
                  {mode === "report" ? (
                    <ShieldAlert className="h-5 w-5" />
                  ) : (
                    <Ban className="h-5 w-5" />
                  )}
                </span>
                <h2 className="font-display text-lg font-bold text-forest">
                  {mode === "report" ? `Report ${who}` : `Block ${who}?`}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {mode === "report" ? (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  What&apos;s wrong? This stays between you and our team.
                </p>
                <div className="mt-3 space-y-1.5">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                        reason === r.id
                          ? "border-forest-600 bg-forest-50 text-forest"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        checked={reason === r.id}
                        onChange={() => setReason(r.id)}
                        className="mt-0.5"
                      />
                      <span className="font-medium">{r.label}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                They won&apos;t be able to send you connection requests or messages,
                and you won&apos;t see each other on Rego.{" "}
                <strong className="text-forest">They are not told.</strong> You can
                undo this later from your account settings.
              </p>
            )}

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                {mode === "report" ? "Anything else we should know? (optional)" : "Reason (optional, private)"}
              </span>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={
                  mode === "report"
                    ? "Dates, message content, anything that helps us understand."
                    : "Only you and our team can see this."
                }
                className="auth-input resize-none"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              >
                {error}
              </p>
            )}

            {mode === "report" && (
              <p className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                If you are in immediate danger, contact local emergency services
                first — reporting here does not alert the police.
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-forest hover:bg-muted"
              >
                Cancel
              </button>
              <Button
                variant="gold"
                disabled={busy}
                onClick={submit}
                className={cn(
                  "flex-1 rounded-lg",
                  mode === "block" && "bg-red-600 text-white hover:bg-red-700"
                )}
              >
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                ) : mode === "report" ? (
                  "Submit report"
                ) : (
                  "Block"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
