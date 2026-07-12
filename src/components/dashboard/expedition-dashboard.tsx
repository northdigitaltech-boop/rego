"use client";

import * as React from "react";
import { Loader2, Save, Check, LogOut, Building2, User as UserIcon, ShieldCheck, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AvatarUpload, ImageUpload, MultiImageUpload } from "@/components/ui/image-upload";
import { type User } from "@/components/auth/auth-context";
import {
  getCompanyByOwner, getProByOwner, createCompany, updateCompany, createPro, updatePro,
  getRoles, getPeaks, getRoutes,
  type ExpeditionCompanyRow, type ExpeditionProRow, type ExpeditionRole, type ExpeditionPeak, type ExpeditionRoute,
} from "@/lib/expeditions";

const COMPANY_SERVICES = [
  "Complete expedition packages", "Base camp trekking", "Mountain guide services", "Trekking guide services",
  "High-altitude porters", "Porters", "Expedition cooks", "Camp staff", "Permit assistance", "Visa support",
  "Airport pickup", "Jeep transport", "Base camp accommodation", "Camping services", "Food & meals",
  "Climbing equipment rental", "Camping equipment rental", "Oxygen cylinder rental", "Satellite phone rental",
  "Rescue coordination", "Medical support", "Photography", "Videography", "Drone coverage", "Custom expedition planning",
];

/* ---------- shared field helpers ---------- */
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="auth-input" />
    </label>
  );
}
function Area({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="auth-input resize-y" />
    </label>
  );
}
function MultiCheck({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div>
      <span className="mb-2 block text-xs font-semibold text-forest">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => toggle(o)}
            aria-pressed={value.includes(o)}
            className={"rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 " +
              (value.includes(o) ? "bg-forest-600 text-white" : "border border-border bg-white text-forest hover:bg-muted")}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-forest">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function VerifyBadge({ status, verified }: { status: string; verified: boolean }) {
  if (verified) return <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-600"><ShieldCheck className="h-4 w-4 text-gold" /> Verified</span>;
  if (status === "approved") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><Check className="h-4 w-4" /> Approved</span>;
  if (status === "rejected") return <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">Rejected</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"><Clock className="h-4 w-4" /> Pending review</span>;
}

export function ExpeditionDashboard({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [loading, setLoading] = React.useState(true);
  const [company, setCompany] = React.useState<ExpeditionCompanyRow | null>(null);
  const [pro, setPro] = React.useState<ExpeditionProRow | null>(null);
  const [roles, setRoles] = React.useState<ExpeditionRole[]>([]);
  const [peaks, setPeaks] = React.useState<ExpeditionPeak[]>([]);
  const [routes, setRoutes] = React.useState<ExpeditionRoute[]>([]);

  const load = React.useCallback(async () => {
    const [c, p, r, pk, rt] = await Promise.all([
      getCompanyByOwner(user.email), getProByOwner(user.email), getRoles(), getPeaks(), getRoutes(),
    ]);
    setCompany(c); setPro(p); setRoles(r); setPeaks(pk); setRoutes(rt); setLoading(false);
  }, [user.email]);
  React.useEffect(() => { load(); }, [load]);

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-forest-600" /></div>;

  const type = company ? "company" : pro ? "individual" : null;

  return (
    <div className="container-px py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-forest">Mountaineering &amp; Expeditions</h1>
          <p className="text-sm text-muted-foreground">Manage your expedition profile.</p>
        </div>
        <div className="flex items-center gap-3">
          {type === "company" && company && <VerifyBadge status={company.status} verified={company.verified} />}
          {type === "individual" && pro && <VerifyBadge status={pro.status} verified={pro.verified} />}
          <Button variant="outline" onClick={onSignOut}><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </div>

      {!type ? (
        <ProfileTypePicker email={user.email} onCreated={load} />
      ) : type === "company" ? (
        <CompanyForm company={company!} peaks={peaks} routes={routes} onSaved={load} />
      ) : (
        <ProForm pro={pro!} roles={roles} peaks={peaks} routes={routes} onSaved={load} />
      )}
    </div>
  );
}

/* ---------- first-run: pick a profile type ---------- */
function ProfileTypePicker({ email, onCreated }: { email: string; onCreated: () => void }) {
  const [busy, setBusy] = React.useState<"company" | "individual" | null>(null);
  const start = async (t: "company" | "individual") => {
    setBusy(t);
    if (t === "company") await createCompany({ owner_email: email, name: "My Expedition Company" });
    else await createPro({ owner_email: email, full_name: "My Name" });
    onCreated();
  };
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-4 text-center text-sm text-muted-foreground">Choose how you want to offer your mountaineering services. You can complete your profile next.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <button onClick={() => start("company")} disabled={!!busy} className="group rounded-3xl border border-border/70 bg-card p-6 text-left shadow-soft transition-all hover:-translate-y-1 hover:border-gold/50 hover:shadow-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-forest text-gold"><Building2 className="h-6 w-6" /></span>
          <h3 className="mt-4 font-display text-lg font-bold text-forest">Expedition Company</h3>
          <p className="mt-1 text-sm text-muted-foreground">Operate full expeditions, manage a team, packages, permits and logistics.</p>
          {busy === "company" && <Loader2 className="mt-3 h-4 w-4 animate-spin text-forest-600" />}
        </button>
        <button onClick={() => start("individual")} disabled={!!busy} className="group rounded-3xl border border-border/70 bg-card p-6 text-left shadow-soft transition-all hover:-translate-y-1 hover:border-gold/50 hover:shadow-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-forest text-gold"><UserIcon className="h-6 w-6" /></span>
          <h3 className="mt-4 font-display text-lg font-bold text-forest">Individual Professional</h3>
          <p className="mt-1 text-sm text-muted-foreground">Offer your service — guide, porter, cook, camp staff, photographer and more.</p>
          {busy === "individual" && <Loader2 className="mt-3 h-4 w-4 animate-spin text-forest-600" />}
        </button>
      </div>
    </div>
  );
}

/* ---------- company profile (core fields) ---------- */
function CompanyForm({ company, peaks, routes, onSaved }: { company: ExpeditionCompanyRow; peaks: ExpeditionPeak[]; routes: ExpeditionRoute[]; onSaved: () => void }) {
  const [c, setC] = React.useState<ExpeditionCompanyRow>(company);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const set = (patch: Partial<ExpeditionCompanyRow>) => setC((p) => ({ ...p, ...patch }));
  const num = (v: string) => (v === "" ? null : Number(v));

  const save = async () => {
    setStatus("saving");
    await updateCompany(c.id, {
      name: c.name, logo: c.logo, cover_image: c.cover_image, description: c.description,
      year_established: c.year_established, city: c.city, district: c.district, address: c.address,
      phone: c.phone, whatsapp: c.whatsapp, email: c.email, website: c.website,
      years_experience: c.years_experience, expeditions_organized: c.expeditions_organized,
      successful_count: c.successful_count, services: c.services, peaks_handled: c.peaks_handled,
      routes_handled: c.routes_handled, rescue_capability: c.rescue_capability, safety_policy: c.safety_policy,
      starting_price: c.starting_price, gallery: c.gallery,
    });
    setStatus("saved"); onSaved(); setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <div className="space-y-5">
      <SaveBar status={status} onSave={save} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Company basics">
          <div className="flex gap-4">
            <div><span className="mb-1 block text-xs font-semibold text-forest">Logo</span><AvatarUpload value={c.logo ?? ""} onChange={(u) => set({ logo: u })} /></div>
            <div className="flex-1"><span className="mb-1 block text-xs font-semibold text-forest">Cover image</span><ImageUpload value={c.cover_image ?? ""} onChange={(u) => set({ cover_image: u })} /></div>
          </div>
          <Field label="Company name" value={c.name} onChange={(v) => set({ name: v })} />
          <Area label="Description" value={c.description ?? ""} onChange={(v) => set({ description: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={c.city ?? ""} onChange={(v) => set({ city: v })} />
            <Field label="District" value={c.district ?? ""} onChange={(v) => set({ district: v })} />
          </div>
          <Field label="Office address" value={c.address ?? ""} onChange={(v) => set({ address: v })} />
        </Card>

        <Card title="Contact & experience">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" value={c.phone ?? ""} onChange={(v) => set({ phone: v })} />
            <Field label="WhatsApp" value={c.whatsapp ?? ""} onChange={(v) => set({ whatsapp: v })} />
            <Field label="Email" value={c.email ?? ""} onChange={(v) => set({ email: v })} />
            <Field label="Website" value={c.website ?? ""} onChange={(v) => set({ website: v })} />
            <Field label="Year established" type="number" value={c.year_established?.toString() ?? ""} onChange={(v) => set({ year_established: num(v) })} />
            <Field label="Years of experience" type="number" value={c.years_experience?.toString() ?? ""} onChange={(v) => set({ years_experience: num(v) })} />
            <Field label="Expeditions organised" type="number" value={c.expeditions_organized?.toString() ?? ""} onChange={(v) => set({ expeditions_organized: num(v) })} />
            <Field label="Successful expeditions" type="number" value={c.successful_count?.toString() ?? ""} onChange={(v) => set({ successful_count: num(v) })} />
            <Field label="Starting price (PKR)" type="number" value={c.starting_price?.toString() ?? ""} onChange={(v) => set({ starting_price: num(v) })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-forest"><input type="checkbox" checked={c.rescue_capability} onChange={(e) => set({ rescue_capability: e.target.checked })} /> Rescue capability</label>
        </Card>
      </div>

      <Card title="Services offered">
        <MultiCheck label="Select all services your company provides" options={COMPANY_SERVICES} value={c.services ?? []} onChange={(v) => set({ services: v })} />
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Peaks handled"><MultiCheck label="Peaks" options={peaks.map((p) => p.name)} value={c.peaks_handled ?? []} onChange={(v) => set({ peaks_handled: v })} /></Card>
        <Card title="Routes handled"><MultiCheck label="Trekking routes" options={routes.map((r) => r.name)} value={c.routes_handled ?? []} onChange={(v) => set({ routes_handled: v })} /></Card>
      </div>
      <Card title="Safety & gallery">
        <Area label="Safety policy" value={c.safety_policy ?? ""} onChange={(v) => set({ safety_policy: v })} />
        <div><span className="mb-1 block text-xs font-semibold text-forest">Gallery</span><MultiImageUpload value={c.gallery ?? []} onChange={(v) => set({ gallery: v })} /></div>
      </Card>
      <SaveBar status={status} onSave={save} />
    </div>
  );
}

/* ---------- individual professional profile (core fields) ---------- */
function ProForm({ pro, roles, peaks, routes, onSaved }: { pro: ExpeditionProRow; roles: ExpeditionRole[]; peaks: ExpeditionPeak[]; routes: ExpeditionRoute[]; onSaved: () => void }) {
  const [p, setP] = React.useState<ExpeditionProRow>(pro);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const set = (patch: Partial<ExpeditionProRow>) => setP((prev) => ({ ...prev, ...patch }));
  const num = (v: string) => (v === "" ? null : Number(v));
  const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    setStatus("saving");
    await updatePro(p.id, {
      full_name: p.full_name, photo: p.photo, cover_image: p.cover_image, role: p.role, title: p.title,
      short_bio: p.short_bio, bio: p.bio, city: p.city, home_village: p.home_village,
      phone: p.phone, whatsapp: p.whatsapp, email: p.email, languages: p.languages,
      years_experience: p.years_experience, total_expeditions: p.total_expeditions,
      highest_peak: p.highest_peak, highest_altitude_m: p.highest_altitude_m,
      daily_rate: p.daily_rate, package_rate: p.package_rate, min_days: p.min_days,
      specializations: p.specializations, skills: p.skills, availability_status: p.availability_status,
      available_peaks: p.available_peaks, available_routes: p.available_routes, gallery: p.gallery,
    });
    setStatus("saved"); onSaved(); setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <div className="space-y-5">
      <SaveBar status={status} onSave={save} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Your profile">
          <div className="flex gap-4">
            <div><span className="mb-1 block text-xs font-semibold text-forest">Photo</span><AvatarUpload value={p.photo ?? ""} onChange={(u) => set({ photo: u })} /></div>
            <div className="flex-1"><span className="mb-1 block text-xs font-semibold text-forest">Cover image</span><ImageUpload value={p.cover_image ?? ""} onChange={(u) => set({ cover_image: u })} /></div>
          </div>
          <Field label="Full name" value={p.full_name} onChange={(v) => set({ full_name: v })} />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-forest">Expedition role</span>
            <select value={p.role ?? ""} onChange={(e) => set({ role: e.target.value })} className="auth-input">
              <option value="">Select a role…</option>
              {roles.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
            </select>
          </label>
          <Field label="Professional title" value={p.title ?? ""} onChange={(v) => set({ title: v })} placeholder="e.g. High-Altitude Guide" />
          <Area label="Short bio" value={p.short_bio ?? ""} onChange={(v) => set({ short_bio: v })} rows={2} />
        </Card>

        <Card title="Contact, region & experience">
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={p.city ?? ""} onChange={(v) => set({ city: v })} />
            <Field label="Home village" value={p.home_village ?? ""} onChange={(v) => set({ home_village: v })} />
            <Field label="Phone" value={p.phone ?? ""} onChange={(v) => set({ phone: v })} />
            <Field label="WhatsApp" value={p.whatsapp ?? ""} onChange={(v) => set({ whatsapp: v })} />
            <Field label="Years of experience" type="number" value={p.years_experience?.toString() ?? ""} onChange={(v) => set({ years_experience: num(v) })} />
            <Field label="Total expeditions" type="number" value={p.total_expeditions?.toString() ?? ""} onChange={(v) => set({ total_expeditions: num(v) })} />
            <Field label="Highest peak" value={p.highest_peak ?? ""} onChange={(v) => set({ highest_peak: v })} />
            <Field label="Highest altitude (m)" type="number" value={p.highest_altitude_m?.toString() ?? ""} onChange={(v) => set({ highest_altitude_m: num(v) })} />
            <Field label="Daily rate (PKR)" type="number" value={p.daily_rate?.toString() ?? ""} onChange={(v) => set({ daily_rate: num(v) })} />
            <Field label="Package rate (PKR)" type="number" value={p.package_rate?.toString() ?? ""} onChange={(v) => set({ package_rate: num(v) })} />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-forest">Availability</span>
            <select value={p.availability_status ?? "available"} onChange={(e) => set({ availability_status: e.target.value })} className="auth-input">
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="seasonal">Seasonal</option>
            </select>
          </label>
          <Field label="Languages (comma separated)" value={(p.languages ?? []).join(", ")} onChange={(v) => set({ languages: csv(v) })} />
          <Field label="Specializations (comma separated)" value={(p.specializations ?? []).join(", ")} onChange={(v) => set({ specializations: csv(v) })} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Available peaks"><MultiCheck label="Peaks you work on" options={peaks.map((pk) => pk.name)} value={p.available_peaks ?? []} onChange={(v) => set({ available_peaks: v })} /></Card>
        <Card title="Available routes"><MultiCheck label="Trekking routes" options={routes.map((r) => r.name)} value={p.available_routes ?? []} onChange={(v) => set({ available_routes: v })} /></Card>
      </div>
      <Card title="Portfolio gallery">
        <MultiImageUpload value={p.gallery ?? []} onChange={(v) => set({ gallery: v })} />
      </Card>
      <SaveBar status={status} onSave={save} />
    </div>
  );
}

function SaveBar({ status, onSave }: { status: "idle" | "saving" | "saved"; onSave: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {status === "saved" && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600"><Check className="h-4 w-4" /> Saved — pending admin review</span>}
      <Button variant="gold" onClick={onSave} disabled={status === "saving"}>
        {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save profile
      </Button>
    </div>
  );
}
