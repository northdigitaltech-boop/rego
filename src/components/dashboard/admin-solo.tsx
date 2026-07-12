"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  Ban,
  Trash2,
  Pencil,
  ExternalLink,
  X,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getAllSolo,
  getAllSoloConnections,
  setSoloStatus,
  setSoloVerified,
  setSoloFeatured,
  deleteSolo,
  updateSolo,
  computeTrustScore,
  soloConnectionRef,
  type SoloTravelerRow,
  type SoloConnectionRow,
} from "@/lib/solo";
import { cn } from "@/lib/utils";

type View = "profiles" | "connections";

export function AdminSolo() {
  const [view, setView] = React.useState<View>("profiles");
  const [profiles, setProfiles] = React.useState<SoloTravelerRow[]>([]);
  const [connections, setConnections] = React.useState<SoloConnectionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<SoloTravelerRow | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([getAllSolo(), getAllSoloConnections()]);
    setProfiles(p);
    setConnections(c);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-forest">Connect Solo Traveler</h2>
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {(["profiles", "connections"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors",
                view === v ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted"
              )}
            >
              {v}
              {v === "connections" && connections.length > 0 && (
                <span className="ml-1.5 text-xs opacity-80">({connections.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : view === "profiles" ? (
        <ProfilesTable profiles={profiles} onChange={refresh} onEdit={setEditing} />
      ) : (
        <ConnectionsTable connections={connections} />
      )}

      {editing && (
        <EditProfileModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ProfilesTable({
  profiles,
  onChange,
  onEdit,
}: {
  profiles: SoloTravelerRow[];
  onChange: () => void;
  onEdit: (p: SoloTravelerRow) => void;
}) {
  const [q, setQ] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await onChange();
    setBusyId(null);
  };
  const rows = profiles.filter((p) => {
    if (!q.trim()) return true;
    return `${p.full_name} ${p.owner_email ?? ""} ${p.current_city ?? ""} ${(p.destinations ?? []).join(" ")} ${p.status}`
      .toLowerCase()
      .includes(q.toLowerCase());
  });

  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search travellers…" className="w-full bg-transparent text-sm focus:outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{rows.length} profiles</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Traveller</th>
              <th className="p-3">City</th>
              <th className="p-3">Destinations</th>
              <th className="p-3">Trust</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No profiles match.</td></tr>
            ) : (
              rows.map((p) => {
                const busy = busyId === p.id;
                return (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-forest">
                        {p.full_name}
                        {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-gold" />}
                        {p.featured && <Star className="h-3.5 w-3.5 fill-gold text-gold" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.owner_email || "—"}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.current_city || "—"}</td>
                    <td className="p-3 text-muted-foreground">{(p.destinations ?? []).slice(0, 2).join(", ") || "—"}</td>
                    <td className="p-3 text-muted-foreground">{computeTrustScore(p)}%</td>
                    <td className="p-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                        p.status === "approved" ? "bg-forest-50 text-forest-600" :
                        p.status === "pending" ? "bg-gold/20 text-gold-700" :
                        p.status === "rejected" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600")}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <a href={`/connect/${p.id}`} target="_blank" rel="noopener noreferrer" title="View" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></a>
                        <button title="Edit / verify" onClick={() => onEdit(p)} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                        {p.status !== "approved" && <button title="Approve" disabled={busy} onClick={() => act(p.id, () => setSoloStatus(p.id, "approved"))} className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600 hover:bg-forest-100"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                        {p.status !== "rejected" && <button title="Reject" disabled={busy} onClick={() => act(p.id, () => setSoloStatus(p.id, "rejected"))} className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"><XCircle className="h-3.5 w-3.5" /></button>}
                        <button title={p.verified ? "Unverify" : "Verify"} disabled={busy} onClick={() => act(p.id, () => setSoloVerified(p.id, !p.verified))} className={cn("rounded-md border p-1.5", p.verified ? "border-gold/40 bg-gold/15 text-gold-700" : "border-border text-forest hover:bg-muted")}><BadgeCheck className="h-3.5 w-3.5" /></button>
                        <button title={p.featured ? "Unfeature" : "Feature"} disabled={busy} onClick={() => act(p.id, () => setSoloFeatured(p.id, !p.featured))} className={cn("rounded-md border p-1.5", p.featured ? "border-gold/40 bg-gold/15 text-gold-700" : "border-border text-forest hover:bg-muted")}><Star className="h-3.5 w-3.5" /></button>
                        {p.status !== "suspended" && <button title="Suspend" disabled={busy} onClick={() => act(p.id, () => setSoloStatus(p.id, "suspended"))} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Ban className="h-3.5 w-3.5" /></button>}
                        <button title="Delete" disabled={busy} onClick={() => { if (window.confirm(`Delete “${p.full_name}”?`)) act(p.id, () => deleteSolo(p.id)); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConnectionsTable({ connections }: { connections: SoloConnectionRow[] }) {
  const [q, setQ] = React.useState("");
  const rows = connections.filter((c) =>
    !q.trim() ||
    `${c.traveler_name ?? ""} ${c.requester_name ?? ""} ${c.requester_email} ${c.kind} ${c.status}`
      .toLowerCase()
      .includes(q.toLowerCase())
  );
  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search connections…" className="w-full bg-transparent text-sm focus:outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{rows.length} requests</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Ref</th>
              <th className="p-3">To (profile)</th>
              <th className="p-3">From</th>
              <th className="p-3">Kind</th>
              <th className="p-3">Seats</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No connections match.</td></tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{soloConnectionRef(c.id)}</td>
                  <td className="p-3 font-semibold text-forest">{c.traveler_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{c.requester_name || c.requester_email}</td>
                  <td className="p-3 capitalize text-muted-foreground">{c.kind.replace("-", " ")}</td>
                  <td className="p-3 text-muted-foreground">{c.seats}</td>
                  <td className="p-3 capitalize text-muted-foreground">{c.status}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: SoloTravelerRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = React.useState({
    full_name: profile.full_name,
    current_city: profile.current_city ?? "",
    nationality: profile.nationality ?? "",
    phone: profile.phone ?? "",
    emergency_contact_status: profile.emergency_contact_status ?? "",
  });
  const [flags, setFlags] = React.useState({
    id_verified: profile.id_verified,
    phone_verified: profile.phone_verified,
    email_verified: profile.email_verified,
    face_verified: profile.face_verified,
    emergency_verified: profile.emergency_verified,
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const toggleFlag = (k: keyof typeof flags) => setFlags((p) => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    setSaving(true);
    await updateSolo(profile.id, {
      full_name: f.full_name.trim(),
      current_city: f.current_city.trim() || null,
      nationality: f.nationality.trim() || null,
      phone: f.phone.trim() || null,
      emergency_contact_status: f.emergency_contact_status.trim() || null,
      ...flags,
    });
    setSaving(false);
    onSaved();
  };

  const FLAGS: { key: keyof typeof flags; label: string }[] = [
    { key: "id_verified", label: "Government ID" },
    { key: "phone_verified", label: "Phone" },
    { key: "email_verified", label: "Email" },
    { key: "face_verified", label: "Face" },
    { key: "emergency_verified", label: "Emergency contact" },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-premium-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-forest">Edit &amp; verify traveller</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-forest"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <L label="Full name"><input className="auth-input" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></L>
          <L label="Nationality"><input className="auth-input" value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></L>
          <L label="Current city"><input className="auth-input" value={f.current_city} onChange={(e) => set("current_city", e.target.value)} /></L>
          <L label="Phone"><input className="auth-input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></L>
          <L label="Emergency contact status"><input className="auth-input" value={f.emergency_contact_status} onChange={(e) => set("emergency_contact_status", e.target.value)} placeholder="e.g. Provided" /></L>
        </div>

        <p className="mt-5 text-sm font-semibold text-forest">Verification badges</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {FLAGS.map((fl) => (
            <button
              key={fl.key}
              type="button"
              onClick={() => toggleFlag(fl.key)}
              className={cn(
                "flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium",
                flags[fl.key] ? "border-green-200 bg-green-50 text-green-700" : "border-border bg-card text-forest hover:bg-muted"
              )}
            >
              {fl.label}
              {flags[fl.key] ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" className="rounded-lg" onClick={onClose}>Cancel</Button>
          <Button variant="gold" className="rounded-lg" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
