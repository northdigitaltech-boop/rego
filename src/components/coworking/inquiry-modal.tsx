"use client";

import * as React from "react";
import Link from "next/link";
import { X, Loader2, CheckCircle2, Briefcase } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import {
  createCoworkingBooking,
  coworkingBookingRef,
  planName,
  PLAN_TYPES,
} from "@/lib/coworking";
import { sendEmail } from "@/lib/email";
import { trackEvent } from "@/lib/track";

export function CoworkingInquiryButton({
  spaceId,
  spaceName,
  ownerEmail,
  ownerContactEmail,
  className,
}: {
  spaceId: string;
  spaceName: string;
  ownerEmail: string | null;
  ownerContactEmail?: string | null;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 font-semibold text-white shadow-soft hover:opacity-95"
        }
      >
        <Briefcase className="h-5 w-5" /> Book / Enquire
      </button>
      {open && (
        <InquiryModal
          spaceId={spaceId}
          spaceName={spaceName}
          ownerEmail={ownerEmail}
          ownerContactEmail={ownerContactEmail}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function InquiryModal({
  spaceId,
  spaceName,
  ownerEmail,
  ownerContactEmail,
  onClose,
}: {
  spaceId: string;
  spaceName: string;
  ownerEmail: string | null;
  ownerContactEmail?: string | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = React.useState(user?.name ?? "");
  const [phone, setPhone] = React.useState("");
  const [plan, setPlan] = React.useState<string>(PLAN_TYPES[0].slug);
  const [startDate, setStartDate] = React.useState("");
  const [duration, setDuration] = React.useState("");
  const [people, setPeople] = React.useState("1");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ref, setRef] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("Please sign in to send a booking request.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: dbErr } = await createCoworkingBooking({
        space_id: spaceId,
        space_name: spaceName,
        owner_email: ownerEmail,
        customer_email: user.email,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        plan_type: plan,
        start_date: startDate || null,
        duration: duration.trim() || null,
        people: Number(people) || 1,
        notes: notes.trim() || null,
      });
      if (dbErr) throw dbErr;
      const number = data?.id ? coworkingBookingRef(data.id) : "CWS";
      setRef(number);
      void trackEvent({
        ownerEmail,
        listingId: spaceId,
        serviceType: "coworking",
        eventType: "booking_request_click",
        userEmail: user.email,
      });
      const to = ownerEmail || ownerContactEmail;
      if (to) {
        void sendEmail(
          to,
          `New co-working booking ${number} — ${spaceName}`,
          `<p>You have a new booking request for <strong>${spaceName}</strong>.</p>` +
            `<p><strong>Plan:</strong> ${planName(plan)}<br/>` +
            `<strong>Name:</strong> ${name}<br/><strong>Phone:</strong> ${phone}` +
            (startDate ? `<br/><strong>Start:</strong> ${startDate}` : "") +
            (duration ? `<br/><strong>Duration:</strong> ${duration}` : "") +
            `<br/><strong>People:</strong> ${people}</p>` +
            (notes ? `<p>${notes}</p>` : ""),
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
              <Briefcase className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-forest">Book a desk</p>
              <p className="text-xs text-muted-foreground">{spaceName}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-forest">
            <X className="h-5 w-5" />
          </button>
        </div>

        {ref ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
            <h3 className="mt-3 font-display text-xl font-bold text-forest">Request sent!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {spaceName} will review your request and get back to you.
            </p>
            <div className="mx-auto mt-4 w-fit rounded-xl border border-border bg-muted/40 px-5 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference</p>
              <p className="font-display text-lg font-bold tracking-wider text-forest">{ref}</p>
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
                <Link href="/signin" className="font-semibold underline">sign in</Link>{" "}
                to send a booking request.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" required>
                <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Phone number" required>
                <input className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
              </Field>
              <Field label="Plan">
                <select className="auth-input" value={plan} onChange={(e) => setPlan(e.target.value)}>
                  {PLAN_TYPES.map((p) => (
                    <option key={p.slug} value={p.slug}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="People">
                <input type="number" min={1} className="auth-input" value={people} onChange={(e) => setPeople(e.target.value)} />
              </Field>
              <Field label="Start date">
                <input type="date" className="auth-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Duration">
                <input className="auth-input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 2 weeks, 1 month" />
              </Field>
            </div>
            <Field label="Notes">
              <textarea rows={3} className="auth-input resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the space should know…" />
            </Field>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <Button type="submit" variant="gold" size="lg" className="w-full rounded-lg" disabled={busy || !user}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Briefcase className="h-4 w-4" /> Send request</>}
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
