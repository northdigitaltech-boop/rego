"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Mail, MailX, Loader2, AlertTriangle } from "lucide-react";

import { statusEmail, type AppStatus } from "@/lib/application-emails";
import { cn } from "@/lib/utils";

/* ============================================================
 * Confirmation before an applicant status email goes out.
 *
 * The admin sees the EXACT subject and body, and can edit it,
 * before anything is sent. Nothing is sent silently.
 *
 * They can also change the status WITHOUT emailing — sometimes
 * you are just tidying the board, or you already phoned the
 * person, and a duplicate email would be worse than none.
 * ============================================================ */

export interface PendingChange {
  applicationId: string;
  status: AppStatus;
  applicantName: string;
  applicantEmail: string;
  role: string;
}

export function StatusEmailDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingChange | null;
  onCancel: () => void;
  /** send=false still applies the status, it just skips the email. */
  onConfirm: (opts: { send: boolean; subject: string; body: string }) => Promise<void>;
}) {
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState<"send" | "skip" | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!pending) return;
    const t = statusEmail(pending.status, pending.applicantName, pending.role);
    setSubject(t.subject);
    setBody(t.body);
    setBusy(null);
  }, [pending]);

  React.useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, busy, onCancel]);

  if (!mounted || !pending) return null;

  const tpl = statusEmail(pending.status, pending.applicantName, pending.role);
  const run = async (send: boolean) => {
    setBusy(send ? "send" : "skip");
    await onConfirm({ send, subject, body });
    setBusy(null);
  };

  const label: Record<AppStatus, string> = {
    new: "New",
    shortlisted: "Shortlisted",
    interview: "Interview",
    hired: "Hired",
    rejected: "Rejected",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-forest-900/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-email-title"
      onClick={() => !busy && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-premium"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="status-email-title" className="font-display text-lg font-bold text-forest">
              Move to {label[pending.status]}
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {pending.applicantName} · {pending.applicantEmail}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={!!busy}
            aria-label="Cancel"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-forest"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!tpl.sends ? (
            <p className="text-sm text-muted-foreground">
              Moving an application back to New doesn&apos;t email anyone. The
              status will just be updated.
            </p>
          ) : (
            <>
              {/* A rejection cannot be unsent. Say so before, not after. */}
              {tpl.tone === "final" && (
                <div className="mb-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed text-amber-800">
                    This tells the applicant they were unsuccessful. Once sent it
                    cannot be taken back — please read it first.
                  </p>
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-forest">
                  Subject
                </span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="auth-input"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-forest">
                  Message — edit anything before sending
                </span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="auth-input resize-none font-sans text-sm leading-relaxed"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
          {tpl.sends ? (
            <>
              <button
                type="button"
                onClick={() => run(true)}
                disabled={!!busy || !subject.trim() || !body.trim()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white",
                  tpl.tone === "final"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-gradient-forest"
                )}
              >
                {busy === "send" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Update &amp; send email
              </button>

              {/* Escape hatch: the admin may have already phoned them. */}
              <button
                type="button"
                onClick={() => run(false)}
                disabled={!!busy}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-forest hover:bg-muted"
              >
                {busy === "skip" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MailX className="h-4 w-4" />
                )}
                Update without email
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => run(false)}
              disabled={!!busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-forest px-4 py-2.5 text-sm font-bold text-white"
            >
              {busy === "skip" && <Loader2 className="h-4 w-4 animate-spin" />}
              Update status
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            disabled={!!busy}
            className="ml-auto text-sm font-semibold text-muted-foreground hover:text-forest"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
