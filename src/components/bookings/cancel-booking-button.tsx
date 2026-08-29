"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { notifyBookingCancelled } from "@/lib/notify-events";
import { cn } from "@/lib/utils";
import {
  CANCELLATION_POLICY_NOTICE,
  CANCEL_REASONS,
  MAX_CUSTOM_REASON,
  MAX_NOTE,
  canCancel,
  bookingStatusMeta,
  type BookingKind,
} from "@/lib/booking-cancellation";

/* ============================================================
 * Cancel booking — button, confirmation modal, result.
 *
 * The button is hidden, not disabled, when the status does not
 * allow cancelling. A greyed-out button on a completed stay
 * invites a click and then explains nothing.
 *
 * Every decision the server will make is made here too, from
 * the same module — so the button never offers something the
 * API refuses. The server is still the authority; this is only
 * so the two agree.
 *
 * WHAT THIS DOES NOT DO
 *   No refund, no payment, no cancellation fee. Rego does not
 *   hold booking money, so anything this screen said about a
 *   refund would be a promise Rego cannot keep. It says who
 *   settles it instead, in the notice above the confirm button.
 * ============================================================ */

export interface CancellableBooking {
  id: string;
  kind: BookingKind;
  reference: string;
  title: string;
  providerName?: string | null;
  bookedOn?: string | null;
  serviceDate?: string | null;
  status: string;
}

export function CancelBookingButton({
  booking,
  onCancelled,
  className,
}: {
  booking: CancellableBooking;
  /** Called with the new status so the list updates without a reload. */
  onCancelled: (info: { id: string; cancelledAt: string; reason: string }) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  if (!canCancel(booking.status)) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600",
          className
        )}
      >
        <XCircle className="h-3.5 w-3.5" /> Cancel
      </button>

      {open && (
        <CancelModal
          booking={booking}
          onClose={() => setOpen(false)}
          onCancelled={onCancelled}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function CancelModal({
  booking,
  onClose,
  onCancelled,
}: {
  booking: CancellableBooking;
  onClose: () => void;
  onCancelled: (info: { id: string; cancelledAt: string; reason: string }) => void;
}) {
  const [reason, setReason] = React.useState("");
  const [custom, setCustom] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  /* Esc closes, but not mid-request — a cancellation is in flight and the
     result still has to be shown. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = async () => {
    /* Guarded rather than trusted: a double click can fire before React has
       re-rendered the disabled button. */
    if (busy || done) return;
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }
    if (reason === "other" && !custom.trim()) {
      setError("Please tell us the reason.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("Your session has expired. Please sign in again.");
        setBusy(false);
        return;
      }

      const res = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: booking.id,
          kind: booking.kind,
          reason,
          customReason: custom.trim(),
          note: note.trim(),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        cancelled_at?: string;
        owner_email?: string | null;
        title?: string;
        dates?: string | null;
      };

      if (!res.ok || !payload.ok) {
        /* The server's message is the specific one — "already cancelled",
           "the provider completed this" — so show it rather than a generic
           failure. */
        setError(payload.error || "Could not cancel this booking.");
        setBusy(false);
        return;
      }

      const shownReason =
        reason === "other"
          ? custom.trim()
          : CANCEL_REASONS.find((r) => r.value === reason)!.label;

      /* Tell the provider through the existing notifier rather than giving
         this route its own mail stack. It is fire-and-forget by design: the
         booking is already cancelled server-side, and a failed email must
         not turn a completed cancellation into an error on screen. */
      if (payload.owner_email) {
        notifyBookingCancelled({
          ownerEmail: payload.owner_email,
          listingTitle: payload.title || booking.title,
          ref: booking.reference,
          reason: shownReason,
          note: note.trim() || null,
          dates: payload.dates ?? booking.serviceDate ?? null,
        });
      }

      setDone(true);
      setBusy(false);
      onCancelled({
        id: booking.id,
        cancelledAt: payload.cancelled_at ?? new Date().toISOString(),
        reason: shownReason,
      });
    } catch {
      /* A network failure here is genuinely ambiguous: the request may have
         reached the server. Saying so is more useful than "failed", because
         it tells them to look before retrying. */
      setError(
        "Could not reach Rego. Check your connection — if your booking now shows as cancelled, it went through."
      );
      setBusy(false);
    }
  };

  const meta = bookingStatusMeta(booking.status);

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cancel this booking"
    >
      <div
        className="absolute inset-0 bg-forest-900/50"
        onClick={() => !busy && onClose()}
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-premium-lg">
        {done ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
            <h2 className="mt-4 font-display text-xl font-bold text-forest">
              Booking cancelled successfully
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your booking has been cancelled. The service provider has been
              notified.
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-xl bg-gradient-forest px-5 py-2.5 text-sm font-semibold text-white shadow-soft"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-base font-bold text-forest">
                Cancel this booking?
              </h2>
              <button
                onClick={() => !busy && onClose()}
                aria-label="Close"
                disabled={busy}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* What is being cancelled. Shown in full because a traveller
                  with several bookings open should not have to trust that
                  they clicked the right row. */}
              <dl className="rounded-2xl bg-muted/50 p-4 text-sm">
                <Row k="Booking ID" v={booking.reference} mono />
                <Row k="Service" v={booking.title} />
                {booking.providerName && (
                  <Row k="Provider" v={booking.providerName} />
                )}
                {booking.bookedOn && <Row k="Booked on" v={booking.bookedOn} />}
                {booking.serviceDate && (
                  <Row k="Travel date" v={booking.serviceDate} />
                )}
                <div className="flex items-baseline justify-between gap-3 py-1">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        meta.cls
                      )}
                    >
                      {meta.label}
                    </span>
                  </dd>
                </div>
              </dl>

              <fieldset>
                <legend className="text-sm font-semibold text-forest">
                  Why are you cancelling?{" "}
                  <span className="font-normal text-red-600">*</span>
                </legend>
                <div className="mt-2 space-y-1.5">
                  {CANCEL_REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors",
                        reason === r.value
                          ? "border-forest-600 bg-forest-50 text-forest"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <input
                        type="radio"
                        name="cancel-reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => {
                          setReason(r.value);
                          setError("");
                        }}
                        className="h-4 w-4 accent-[#0F4C3A]"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>

                {reason === "other" && (
                  <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    maxLength={MAX_CUSTOM_REASON}
                    placeholder="Tell us the reason"
                    autoFocus
                    className="auth-input mt-2 w-full"
                  />
                )}
              </fieldset>

              <label className="block">
                <span className="text-sm font-semibold text-forest">
                  Additional note{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={MAX_NOTE}
                  rows={3}
                  placeholder="Anything the provider should know"
                  className="auth-input mt-1 w-full resize-none"
                />
              </label>

              <p className="flex gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-3 text-[13px] leading-relaxed text-forest">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
                {CANCELLATION_POLICY_NOTICE}
              </p>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
              <button
                onClick={() => !busy && onClose()}
                disabled={busy}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-forest hover:bg-muted disabled:opacity-50"
              >
                Keep booking
              </button>
              {/* Red is reserved for this one control. Everything else in the
                  modal is neutral so the destructive action is unmistakable. */}
              <button
                onClick={submit}
                disabled={busy || !reason}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Cancelling…" : "Confirm cancellation"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd
        className={cn(
          "text-right font-medium text-forest",
          mono && "font-display tracking-wider"
        )}
      >
        {v}
      </dd>
    </div>
  );
}
