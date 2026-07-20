"use client";

import * as React from "react";
import { Loader2, Save, Check, LogOut, Building2, User as UserIcon, ShieldCheck, Clock, Plus, Trash2, Pencil, Users, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AvatarUpload, ImageUpload, MultiImageUpload } from "@/components/ui/image-upload";
import { type User } from "@/components/auth/auth-context";
import {
  getCompanyByOwner, getProByOwner, createCompany, updateCompany, createPro, updatePro,
  getRoles, getPeaks, getRoutes,
  getTeamMembers, saveTeamMember, deleteTeamMember,
  getPackagesByCompany, savePackage, deletePackage, packagePriceLabel,
  type ExpeditionCompanyRow, type ExpeditionProRow, type ExpeditionRole, type ExpeditionPeak, type ExpeditionRoute,
  type ExpeditionTeamMember, type ExpeditionPackageRow, type PackageGroupTier,
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
  const [tab, setTab] = React.useState<"profile" | "team" | "packages">("profile");

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
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {(
              [
                ["profile", "Company Profile"],
                ["team", "Team"],
                ["packages", "Packages & Pricing"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 " +
                  (tab === id
                    ? "bg-gradient-forest text-white shadow-soft"
                    : "border border-border bg-card text-forest hover:bg-muted")
                }
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "profile" && <CompanyForm company={company!} peaks={peaks} routes={routes} onSaved={load} />}
          {tab === "team" && <TeamManager companyId={company!.id} roles={roles} />}
          {tab === "packages" && (
            <PackagesManager company={company!} peaks={peaks} routes={routes} />
          )}
        </>
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

/* ================================================================== */
/* Phase 3 — Team management                                           */
/* ================================================================== */

const csv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
const uncsv = (a?: string[] | null) => (a ?? []).join(", ");

function TeamManager({ companyId, roles }: { companyId: string; roles: ExpeditionRole[] }) {
  const [members, setMembers] = React.useState<ExpeditionTeamMember[] | null>(null);
  const [editing, setEditing] = React.useState<Partial<ExpeditionTeamMember> | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => setMembers(await getTeamMembers(companyId)), [companyId]);
  React.useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing?.name?.trim()) return;
    setBusy(true);
    await saveTeamMember({ ...editing, company_id: companyId, name: editing.name.trim() });
    setBusy(false); setEditing(null); load();
  };

  if (!members) return <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-forest-600" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-forest"><Users className="h-5 w-5 text-forest-600" /> Your Team ({members.length})</h2>
        <Button variant="gold" onClick={() => setEditing({ display_order: members.length })}><Plus className="h-4 w-4" /> Add member</Button>
      </div>
      <p className="text-sm text-muted-foreground">Introduce your guides, high-altitude porters, cooks and camp staff. The team is shown publicly on your company profile — it builds real trust with climbers.</p>

      {editing && (
        <Card title={editing.id ? "Edit team member" : "New team member"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name *" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-forest">Role</span>
              <select value={editing.role ?? ""} onChange={(e) => setEditing({ ...editing, role: e.target.value || null })} className="auth-input">
                <option value="">Select role…</option>
                {roles.filter((r) => r.active).map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </label>
            <Field label="Years of experience" type="number" value={String(editing.years_experience ?? "")} onChange={(v) => setEditing({ ...editing, years_experience: v ? Number(v) : null })} />
            <Field label="Peaks summited (comma separated)" value={uncsv(editing.peaks_summited)} onChange={(v) => setEditing({ ...editing, peaks_summited: csv(v) })} />
            <Field label="Certifications (public, comma separated)" value={uncsv(editing.certifications)} onChange={(v) => setEditing({ ...editing, certifications: csv(v) })} />
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold text-forest">Photo</span>
            <AvatarUpload value={editing.photo ?? ""} onChange={(url) => setEditing({ ...editing, photo: url })} />
          </div>
          <Area label="Short bio" value={editing.bio ?? ""} onChange={(v) => setEditing({ ...editing, bio: v })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="gold" onClick={save} disabled={busy || !editing.name?.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save member
            </Button>
          </div>
        </Card>
      )}

      {members.length === 0 && !editing && (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No team members yet — add your first guide or porter.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
              {m.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-6 w-6 text-forest-600" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-forest">{m.name}</p>
              <p className="text-xs text-muted-foreground">
                {m.role ?? "Team member"}
                {m.years_experience ? ` · ${m.years_experience} yrs` : ""}
              </p>
              {m.peaks_summited && m.peaks_summited.length > 0 && (
                <p className="mt-1 truncate text-xs text-forest-600">Summits: {m.peaks_summited.join(", ")}</p>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(m)} aria-label={`Edit ${m.name}`} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
              <button
                onClick={async () => { if (window.confirm(`Remove ${m.name} from the team?`)) { await deleteTeamMember(m.id); load(); } }}
                aria-label={`Remove ${m.name}`}
                className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Phase 3 — Packages, availability & pricing                          */
/* ================================================================== */

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function PackagesManager({ company, peaks, routes }: { company: ExpeditionCompanyRow; peaks: ExpeditionPeak[]; routes: ExpeditionRoute[] }) {
  const [pkgs, setPkgs] = React.useState<ExpeditionPackageRow[] | null>(null);
  const [editing, setEditing] = React.useState<Partial<ExpeditionPackageRow> | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => setPkgs(await getPackagesByCompany(company.id)), [company.id]);
  React.useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing?.title?.trim()) return;
    setBusy(true);
    await savePackage({ ...editing, company_id: company.id, owner_email: company.owner_email, title: editing.title.trim() });
    setBusy(false); setEditing(null); load();
  };

  const tiers: PackageGroupTier[] = (editing?.group_tiers as PackageGroupTier[]) ?? [];
  const setTier = (i: number, patch: Partial<PackageGroupTier>) =>
    setEditing({ ...editing!, group_tiers: tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  if (!pkgs) return <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-forest-600" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-forest"><Package className="h-5 w-5 text-forest-600" /> Expedition Packages ({pkgs.length})</h2>
        <Button variant="gold" onClick={() => setEditing({ group_min: 1, currency: company.currency || "PKR", active: true, group_tiers: [] })}><Plus className="h-4 w-4" /> Add package</Button>
      </div>
      <p className="text-sm text-muted-foreground">Create sellable expeditions & treks with seasons, group sizes and pricing. Leave the price empty to show “Quote on request”. Active packages appear on your public profile.</p>

      {editing && (
        <Card title={editing.id ? "Edit package" : "New package"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Package title *" value={editing.title ?? ""} onChange={(v) => setEditing({ ...editing, title: v })} placeholder="K2 Base Camp Trek 2027" />
            <Field label="Duration (days)" type="number" value={String(editing.duration_days ?? "")} onChange={(v) => setEditing({ ...editing, duration_days: v ? Number(v) : null })} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-forest">Peak</span>
              <select value={editing.peak ?? ""} onChange={(e) => setEditing({ ...editing, peak: e.target.value || null })} className="auth-input">
                <option value="">None / custom…</option>
                {peaks.filter((p) => p.active).map((p) => <option key={p.id} value={p.name}>{p.name}{p.height_m ? ` (${p.height_m}m)` : ""}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-forest">Route / trek</span>
              <select value={editing.route ?? ""} onChange={(e) => setEditing({ ...editing, route: e.target.value || null })} className="auth-input">
                <option value="">None / custom…</option>
                {routes.filter((r) => r.active).map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </label>
            <Field label="Min group size" type="number" value={String(editing.group_min ?? 1)} onChange={(v) => setEditing({ ...editing, group_min: Math.max(1, Number(v) || 1) })} />
            <Field label="Max group size" type="number" value={String(editing.group_max ?? "")} onChange={(v) => setEditing({ ...editing, group_max: v ? Number(v) : null })} />
            <Field label="Price per person (blank = quote on request)" type="number" value={String(editing.price_per_person ?? "")} onChange={(v) => setEditing({ ...editing, price_per_person: v ? Number(v) : null })} />
            <Field label="Next departure (optional)" type="date" value={editing.next_departure ?? ""} onChange={(v) => setEditing({ ...editing, next_departure: v || null })} />
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold text-forest">Group price tiers (optional — per-person price for group sizes)</span>
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input type="number" value={t.min || ""} placeholder="Min" onChange={(e) => setTier(i, { min: Number(e.target.value) || 1 })} className="auth-input w-24" aria-label="Tier minimum group size" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input type="number" value={t.max ?? ""} placeholder="Max" onChange={(e) => setTier(i, { max: e.target.value ? Number(e.target.value) : null })} className="auth-input w-24" aria-label="Tier maximum group size" />
                  <span className="text-xs text-muted-foreground">people →</span>
                  <input type="number" value={t.price_per_person || ""} placeholder="Price / person" onChange={(e) => setTier(i, { price_per_person: Number(e.target.value) || 0 })} className="auth-input w-40" aria-label="Tier price per person" />
                  <button type="button" onClick={() => setEditing({ ...editing!, group_tiers: tiers.filter((_, j) => j !== i) })} aria-label="Remove tier" className="grid h-9 w-9 place-items-center rounded-lg border border-border text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setEditing({ ...editing!, group_tiers: [...tiers, { min: 2, max: 4, price_per_person: 0 }] })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest-600 hover:text-gold"><Plus className="h-3.5 w-3.5" /> Add tier</button>
          </div>

          <MultiCheck label="Season / available months" options={MONTHS} value={editing.season_months ?? []} onChange={(v) => setEditing({ ...editing, season_months: v })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Included (comma separated)" value={uncsv(editing.includes)} onChange={(v) => setEditing({ ...editing, includes: csv(v) })} placeholder="Permits, Porters, Meals, Base camp tents" />
            <Field label="Not included (comma separated)" value={uncsv(editing.excludes)} onChange={(v) => setEditing({ ...editing, excludes: csv(v) })} placeholder="International flights, Personal gear, Insurance" />
          </div>
          <Area label="Description" value={editing.description ?? ""} onChange={(v) => setEditing({ ...editing, description: v })} rows={4} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-semibold text-forest">Cover image</span>
              <ImageUpload value={editing.image ?? ""} onChange={(url) => setEditing({ ...editing, image: url })} />
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold text-forest">Gallery</span>
              <MultiImageUpload value={editing.gallery ?? []} onChange={(urls) => setEditing({ ...editing, gallery: urls })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-forest">
            <input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="h-4 w-4 accent-forest-600" />
            Active (visible on your public profile)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="gold" onClick={save} disabled={busy || !editing.title?.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save package
            </Button>
          </div>
        </Card>
      )}

      {pkgs.length === 0 && !editing && (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No packages yet — add your first expedition or trek.</p>
      )}
      <div className="space-y-3">
        {pkgs.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-forest">
                {p.title}
                {!p.active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Hidden</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {[p.peak, p.route, p.duration_days ? `${p.duration_days} days` : null, p.season_months?.length ? p.season_months.join(", ") : null].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-forest-600">{packagePriceLabel(p)}{p.group_tiers?.length ? ` · ${p.group_tiers.length} group tier${p.group_tiers.length > 1 ? "s" : ""}` : ""}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(p)} aria-label={`Edit ${p.title}`} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
              <button
                onClick={async () => { if (window.confirm(`Delete package "${p.title}"?`)) { await deletePackage(p.id); load(); } }}
                aria-label={`Delete ${p.title}`}
                className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
