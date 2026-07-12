"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MapPin, CheckCircle2, Megaphone } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { ImageUpload } from "@/components/ui/image-upload";
import { createReport, REPORT_TYPES } from "@/lib/rego-map";
import { sendEmail } from "@/lib/email";

const ADMIN_EMAIL = "northdigitaltech@gmail.com";

const TYPE_LABEL: Record<string, string> = {
  "road-blocked": "Road blocked",
  "road-open": "Road open again",
  landslide: "Landslide",
  snowfall: "Snowfall",
  accident: "Accident",
  traffic: "Heavy traffic",
  bridge: "Broken bridge",
  rescue: "Rescue needed",
};

/** Traveler "Report Road Update" form — stays pending until an admin verifies. */
export function RegoMapReport() {
  const { user } = useAuth();
  const [type, setType] = React.useState<string>(REPORT_TYPES[0]);
  const [location, setLocation] = React.useState("");
  const [road, setRoad] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [photo, setPhoto] = React.useState("");
  const [coords, setCoords] = React.useState<[number, number] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState("");

  const useGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => setCoords([p.coords.latitude, p.coords.longitude]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) { setError("Please sign in to submit a report."); return; }
    if (!location.trim() && !coords) { setError("Add a location or use your GPS."); return; }
    setBusy(true);
    try {
      const { error: dbErr } = await createReport({
        user_email: user.email,
        user_name: user.name,
        report_type: type,
        location_name: location.trim() || null,
        road_name: road.trim() || null,
        latitude: coords?.[0] ?? null,
        longitude: coords?.[1] ?? null,
        description: description.trim() || null,
        photo: photo || null,
        video: null,
      });
      if (dbErr) throw dbErr;
      void sendEmail(
        ADMIN_EMAIL,
        `New Rego Map road report — ${TYPE_LABEL[type] ?? type}`,
        `<p><strong>${user.name}</strong> reported: ${TYPE_LABEL[type] ?? type}</p>` +
          `<p><strong>Location:</strong> ${location || (coords ? coords.join(", ") : "—")}` +
          (road ? `<br/><strong>Road:</strong> ${road}` : "") + `</p>` +
          (description ? `<p>${description}</p>` : "") +
          `<p>Review it in Admin → Rego Map → Reports.</p>`
      ).catch(() => {});
      setDone(true);
    } catch {
      setError("Could not submit. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-base font-bold text-forest">Report submitted</p>
        <p className="mt-1 text-sm text-muted-foreground">Thanks! It&apos;s pending review and will appear on the map once verified.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {!user && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Please <Link href="/signin" className="font-semibold underline">sign in</Link> to report.
        </div>
      )}
      <Field label="What's happening?">
        <select className="auth-input" value={type} onChange={(e) => setType(e.target.value)}>
          {REPORT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Location"><input className="auth-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. near Chilas" /></Field>
        <Field label="Road (optional)"><input className="auth-input" value={road} onChange={(e) => setRoad(e.target.value)} placeholder="KKH…" /></Field>
      </div>
      <button type="button" onClick={useGps} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-forest hover:bg-muted">
        <MapPin className="h-3.5 w-3.5" /> {coords ? `GPS set (${coords[0].toFixed(3)}, ${coords[1].toFixed(3)})` : "Use my GPS location"}
      </button>
      <Field label="Description"><textarea rows={2} className="auth-input resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the road situation…" /></Field>
      <div>
        <span className="mb-1 block text-xs font-semibold text-forest">Photo (optional)</span>
        <ImageUpload value={photo} onChange={setPhoto} />
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <button type="submit" disabled={busy || !user} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><Megaphone className="h-4 w-4" /> Submit for verification</>}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      {children}
    </label>
  );
}
