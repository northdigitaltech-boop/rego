"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  CheckCircle2,
  LifeBuoy,
  Phone,
  MessageCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { useAuth } from "@/components/auth/auth-context";
import {
  createRoadsideRequest,
  serviceName,
  VEHICLE_TYPES,
  URGENCY_LEVELS,
  ROADSIDE_SERVICES,
} from "@/lib/roadside";
import { sendEmail } from "@/lib/email";
import { cn } from "@/lib/utils";

export interface RequestModalProvider {
  id: string;
  business_name: string;
  owner_email: string | null;
  email?: string | null;
  services: string[]; // service_type slugs the provider offers
}

export function RoadsideRequestModal({
  provider,
  defaultService,
  onClose,
}: {
  provider: RequestModalProvider;
  defaultService?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();

  const offered =
    provider.services.length > 0 ? provider.services : ROADSIDE_SERVICES.map((s) => s.slug);

  const [name, setName] = React.useState(user?.name ?? "");
  const [phone, setPhone] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [vehicle, setVehicle] = React.useState<string>(VEHICLE_TYPES[0]);
  const [service, setService] = React.useState(
    defaultService && offered.includes(defaultService) ? defaultService : offered[0]
  );
  const [problem, setProblem] = React.useState("");
  const [image, setImage] = React.useState("");
  const [urgency, setUrgency] = React.useState<string>("normal");
  const [contact, setContact] = React.useState<"call" | "whatsapp">("call");

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ref, setRef] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("Please sign in to send an emergency request.");
      return;
    }
    if (!name.trim() || !phone.trim() || !location.trim()) {
      setError("Name, phone number and your current location are required.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: dbErr } = await createRoadsideRequest({
        customer_email: user.email,
        provider_id: provider.id,
        owner_email: provider.owner_email,
        service_type: service,
        provider_name: provider.business_name,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_whatsapp: whatsapp.trim() || null,
        location_address: location.trim(),
        vehicle_type: vehicle,
        problem_description: problem.trim() || null,
        image_url: image || null,
        urgency,
        preferred_contact_method: contact,
      });
      if (dbErr) throw dbErr;
      const number = data?.request_number ?? "RSA";
      setRef(number);
      // Best-effort notification to the provider (non-blocking).
      const to = provider.owner_email || provider.email;
      if (to) {
        const body =
          `<p>A customer needs roadside help.</p>` +
          `<p><strong>Request:</strong> ${number}<br/>` +
          `<strong>Service:</strong> ${serviceName(service)}<br/>` +
          `<strong>Urgency:</strong> ${urgency}<br/>` +
          `<strong>Vehicle:</strong> ${vehicle}<br/>` +
          `<strong>Location:</strong> ${location}<br/>` +
          `<strong>Name:</strong> ${name}<br/>` +
          `<strong>Phone:</strong> ${phone}` +
          (whatsapp ? `<br/><strong>WhatsApp:</strong> ${whatsapp}` : "") +
          `<br/><strong>Contact via:</strong> ${contact}</p>` +
          (problem ? `<p>${problem}</p>` : "");
        void sendEmail(to, `New roadside request ${number} — ${serviceName(service)}`, body).catch(
          () => {}
        );
      }
    } catch {
      setError("Could not send your request. Please try again or call the provider directly.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-premium-lg sm:rounded-3xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-red-600">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-forest">Request Help</p>
              <p className="text-xs text-muted-foreground">{provider.business_name}</p>
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
              {provider.business_name} has been notified and will respond shortly.
            </p>
            <div className="mx-auto mt-4 w-fit rounded-xl border border-border bg-muted/40 px-5 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tracking number</p>
              <p className="font-display text-lg font-bold tracking-wider text-forest">{ref}</p>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Track the status any time from your{" "}
              <Link href="/dashboard" className="font-semibold text-forest-600 underline">
                dashboard
              </Link>
              .
            </p>
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
                to send an emergency request.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" required>
                <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </Field>
              <Field label="Phone number" required>
                <input className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
              </Field>
              <Field label="WhatsApp number">
                <input className="auth-input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="Optional" />
              </Field>
              <Field label="Vehicle type">
                <select className="auth-input" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Current location / address" required>
              <input className="auth-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Landmark, road or GPS pin description" />
            </Field>

            <Field label="Service needed">
              <select className="auth-input" value={service} onChange={(e) => setService(e.target.value)}>
                {offered.map((s) => (
                  <option key={s} value={s}>{serviceName(s)}</option>
                ))}
              </select>
            </Field>

            <Field label="Problem description">
              <textarea
                rows={3}
                className="auth-input resize-none"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="Describe what happened…"
              />
            </Field>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-forest">Photo (optional)</span>
              <ImageUpload value={image} onChange={setImage} />
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-forest">Urgency</span>
              <div className="grid grid-cols-3 gap-2">
                {URGENCY_LEVELS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition-colors",
                      urgency === u
                        ? u === "emergency"
                          ? "border-red-300 bg-red-50 text-red-600"
                          : u === "urgent"
                            ? "border-gold/40 bg-gold/15 text-gold-700"
                            : "border-forest-200 bg-forest-50 text-forest-600"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-forest">Preferred contact</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContact("call")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                    contact === "call" ? "border-forest-300 bg-forest-50 text-forest-600" : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Phone className="h-4 w-4" /> Call
                </button>
                <button
                  type="button"
                  onClick={() => setContact("whatsapp")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                    contact === "whatsapp" ? "border-forest-300 bg-forest-50 text-forest-600" : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </button>
              </div>
            </div>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <Button type="submit" variant="gold" size="lg" className="w-full rounded-lg" disabled={busy || !user}>
              {busy ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              ) : (
                <><LifeBuoy className="h-4 w-4" /> Submit Request</>
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
