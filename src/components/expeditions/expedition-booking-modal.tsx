"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mountain, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { sendEmail } from "@/lib/email";
import { trackEvent } from "@/lib/track";
import {
  createExpeditionBooking,
  expeditionBookingRef,
  type ExpeditionSubjectKind,
} from "@/lib/expeditions";

/* ============================================================
 * Ask an expedition provider for a quote.
 *
 * WHY A QUOTE AND NOT A PRICE
 *   An expedition is priced after a conversation about the peak,
 *   the season, the permit and the team. There is no nightly rate
 *   to multiply, so this form collects the ASK — peak, route,
 *   dates, group size, experience — and the money is agreed
 *   between the two of them. Rego does not process payments, here
 *   or anywhere else.
 *
 * WHY ONLY NAME AND PHONE ARE REQUIRED
 *   Somebody enquiring in January about "an 8000er, sometime in
 *   summer" is a real customer. A form that refuses them until
 *   they invent an exact date turns a lead into a bounce. The
 *   database agrees: only people is NOT NULL.
 *
 * SAFETY NOTE, SHOWN NOT BURIED
 *   High-altitude climbing can kill people. The line at the foot
 *   of the form says what Rego is and is not responsible for,
 *   before the request is sent rather than after.
 * ============================================================ */

export function ExpeditionQuoteButton(props: {
  subjectKind: ExpeditionSubjectKind;
  subjectId: string;
  subjectTitle: string;
  ownerEmail: string | null;
  /** Prefilled when the subject is a package that already names one. */
  defaultPeak?: string | null;
  defaultRoute?: string | null;
  defaultDays?: number | null;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 font-semibold text-white shadow-soft hover:opacity-95"
      >
        <Mountain className="h-5 w-5" /> {props.label ?? "Request a quote"}
      </button>
      {open && <Modal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

const EXPERIENCE = [
  "First time at altitude",
  "Some trekking experience",
  "Experienced trekker",
  "Experienced climber",
];

function Modal({
  subjectKind,
  subjectId,
  subjectTitle,
  ownerEmail,
  defaultPeak,
  defaultRoute,
  defaultDays,
  onClose,
}: {
  subjectKind: ExpeditionSubjectKind;
  subjectId: string;
  subjectTitle: string;
  ownerEmail: string | null;
  defaultPeak?: string | null;
  defaultRoute?: string | null;
  defaultDays?: number | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = React.useState(user?.name ?? "");
  const [phone, setPhone] = React.useState("");
  const [peak, setPeak] = React.useState(defaultPeak ?? "");
  const [route, setRoute] = React.useState(defaultRoute ?? "");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [days, setDays] = React.useState(defaultDays ? String(defaultDays) : "");
  const [people, setPeople] = React.useState("1");
  const [experience, setExperience] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ref, setRef] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user) {
      setError("Please sign in to send a request.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    /* Checked here so the person gets a sentence rather than a constraint
       violation. The database checks it too — this is the courtesy copy. */
    if (startDate && endDate && endDate < startDate) {
      setError("The end date is before the start date.");
      return;
    }

    setBusy(true);
    try {
      const { data, error: dbErr } = await createExpeditionBooking({
        subject_kind: subjectKind,
        /* Exactly one of these, matching the kind — the phase114 CHECK
           refuses anything else, so the shape is decided here once. */
        company_id: subjectKind === "company" ? subjectId : null,
        pro_id: subjectKind === "professional" ? subjectId : null,
        package_id: subjectKind === "package" ? subjectId : null,
        subject_title: subjectTitle,
        owner_email: ownerEmail,
        customer_email: user.email,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        peak: peak.trim() || null,
        route: route.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        days: days ? Number(days) : null,
        people: Number(people) || 1,
        experience_level: experience || null,
        notes: notes.trim() || null,
      });
      if (dbErr) throw dbErr;

      const number = data?.id ? expeditionBookingRef(data.id) : "EXP";
      setRef(number);

      void trackEvent({
        ownerEmail,
        listingId: subjectId,
        serviceType: "expeditions",
        eventType: "booking_request_click",
        userEmail: user.email,
      });

      if (ownerEmail) {
        void sendEmail(
          ownerEmail,
          `New expedition enquiry ${number} — ${subjectTitle}`,
          `<p>You have a new enquiry for <strong>${subjectTitle}</strong>.</p>` +
            `<p><strong>Name:</strong> ${name}<br/><strong>Phone:</strong> ${phone}` +
            (peak ? `<br/><strong>Peak:</strong> ${peak}` : "") +
            (route ? `<br/><strong>Route:</strong> ${route}` : "") +
            (startDate ? `<br/><strong>From:</strong> ${startDate}` : "") +
            (endDate ? `<br/><strong>To:</strong> ${endDate}` : "") +
            (days ? `<br/><strong>Days:</strong> ${days}` : "") +
            `<br/><strong>People:</strong> ${people}` +
            (experience ? `<br/><strong>Experience:</strong> ${experience}` : "") +
            `</p>` +
            (notes ? `<p>${notes}</p>` : "")
        ).catch(() => {});
      }
    } catch {
      setError("Could not send your request. Please try again.");
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
              <Mountain className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-forest">
                Request a quote
              </p>
              <p className="text-xs text-muted-foreground">{subjectTitle}</p>
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

        {ref ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
            <h3 className="mt-3 font-display text-xl font-bold text-forest">
              Request sent
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              They will review it and come back to you with a quote. Nothing is
              booked and nothing is owed until you agree terms with them
              directly.
            </p>
            <div className="mx-auto mt-4 w-fit rounded-xl border border-border bg-muted/40 px-5 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Reference
              </p>
              <p className="font-display text-lg font-bold tracking-wider text-forest">
                {ref}
              </p>
            </div>
            <Button variant="gold" className="mt-5 w-full rounded-lg" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-5 py-5">
            {!user && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                Please{" "}
                <Link href="/signin" className="font-semibold underline">
                  sign in
                </Link>{" "}
                to send a request.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" required>
                <input
                  className="auth-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Phone number" required>
                <input
                  className="auth-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 3xx xxxxxxx"
                />
              </Field>
              <Field label="Peak">
                <input
                  className="auth-input"
                  value={peak}
                  onChange={(e) => setPeak(e.target.value)}
                  placeholder="e.g. K2, Broad Peak"
                />
              </Field>
              <Field label="Route">
                <input
                  className="auth-input"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="From">
                <input
                  type="date"
                  className="auth-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  className="auth-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
              <Field label="Days">
                <input
                  type="number"
                  min={1}
                  className="auth-input"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="People" required>
                <input
                  type="number"
                  min={1}
                  className="auth-input"
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Your experience">
              <select
                className="auth-input"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              >
                <option value="">Prefer not to say</option>
                {EXPERIENCE.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Anything else they should know">
              <textarea
                rows={3}
                className="auth-input resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Fitness, altitude history, permits already held…"
              />
            </Field>

            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Mountaineering and high-altitude trekking carry serious risk. Rego
              connects you with the provider and does not guarantee safety,
              success or summit completion. Check credentials, insurance,
              permits and medical requirements before you commit.
            </p>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <Button
              type="submit"
              variant="gold"
              size="lg"
              className="w-full rounded-lg"
              disabled={busy || !user}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Mountain className="h-4 w-4" /> Send request
                </>
              )}
            </Button>
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
