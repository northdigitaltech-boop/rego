"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Plane, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";

/* ============================================================
 * "Request this flight".
 *
 * The honest version of a booking button while Rego cannot issue
 * tickets. It does not pretend to book: it records what the
 * customer chose and hands it to the team, which is exactly what
 * the concierge offer on /flights already promises.
 *
 * WHAT THE COPY HAS TO DO
 *   Somebody clicking a big green button on a page showing a
 *   price and a seat count reasonably expects to have bought
 *   something. Every surface here — the button, the panel, the
 *   confirmation, the email — says nothing is booked and no seat
 *   is held. That is not legal throat-clearing; it is the
 *   difference between a happy customer and one who turns up at
 *   an airport.
 *
 * Signing in is NOT required. An account makes the request show
 * in their dashboard, and that is the only difference.
 * ============================================================ */

export function FlightRequestButton({
  offerId,
  priceLabel,
}: {
  offerId: string;
  priceLabel: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-xl bg-gradient-forest px-4 py-3 text-sm font-bold text-white shadow-soft transition-transform hover:-translate-y-0.5"
      >
        Request this flight
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Our team confirms the fare with the airline and books it for you.
        Nothing is charged here.
      </p>

      {open && (
        <RequestPanel
          offerId={offerId}
          priceLabel={priceLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function RequestPanel({
  offerId,
  priceLabel,
  onClose,
}: {
  offerId: string;
  priceLabel: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = React.useState(user?.name ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [phone, setPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [reference, setReference] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (name.trim().length < 2) return setError("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      return setError("Please enter a valid email address.");
    }
    if (phone.replace(/[^0-9]/g, "").length < 7) {
      return setError("Please enter a phone number we can reach you on.");
    }

    setBusy(true);
    try {
      /* The token is optional — it only links the request to an account. */
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch("/api/flights/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        /* No price is sent. The server reads it from the stored offer. */
        body: JSON.stringify({
          offerId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        }),
      });

      const json = (await res.json()) as {
        ok: boolean;
        reference?: string;
        error?: string;
      };

      if (!json.ok) {
        setError(json.error ?? "We could not send your request. Please try again.");
        return;
      }
      setReference(json.reference ?? null);
    } catch {
      setError("We could not reach Rego just now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-premium-lg sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-50 text-forest-600">
              <Plane className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-forest">
                Request this flight
              </p>
              <p className="text-xs text-muted-foreground">{priceLabel} on screen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-forest"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {reference ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
            <h3 className="mt-3 font-display text-xl font-bold text-forest">
              Request received
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Our team will confirm the fare with the airline and come back to
              you. Fares move, so the final price may differ from the{" "}
              {priceLabel} shown here.
            </p>

            <div className="mx-auto mt-4 w-fit rounded-xl border border-border bg-muted/40 px-5 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Reference
              </p>
              <p className="font-display text-lg font-bold tracking-wider text-forest">
                {reference}
              </p>
            </div>

            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
              Nothing is booked yet and no seat is held. Do not make other
              travel arrangements until we confirm.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-gradient-forest px-4 py-3 text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-5 py-5">
            <p className="rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest">
              Send us this flight and we will book it for you. Nothing is
              charged on this screen and no seat is held until our team
              confirms with the airline.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" required>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input"
                  autoComplete="name"
                />
              </Field>
              <Field label="Phone" required>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 3xx xxxxxxx"
                  className="auth-input"
                  autoComplete="tel"
                />
              </Field>
            </div>

            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                autoComplete="email"
              />
            </Field>

            <Field label="Anything we should know">
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Flexible by a day either side, seat preference, assistance needed…"
                className="auth-input resize-none"
              />
            </Field>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Plane className="h-4 w-4" /> Send request
                </>
              )}
            </button>

            {!user && (
              <p className="text-center text-xs text-muted-foreground">
                You do not need an account. Signing in just keeps this request
                in your Rego dashboard.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
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
