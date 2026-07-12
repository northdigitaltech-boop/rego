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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getAllCoworking,
  getAllCoworkingBookings,
  setCoworkingStatus,
  setCoworkingVerified,
  deleteCoworking,
  updateCoworking,
  planName,
  type CoworkingSpaceRow,
  type CoworkingBookingRow,
} from "@/lib/coworking";
import { cn } from "@/lib/utils";

type View = "spaces" | "bookings";

export function AdminCoworking() {
  const [view, setView] = React.useState<View>("spaces");
  const [spaces, setSpaces] = React.useState<CoworkingSpaceRow[]>([]);
  const [bookings, setBookings] = React.useState<CoworkingBookingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<CoworkingSpaceRow | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [s, b] = await Promise.all([getAllCoworking(), getAllCoworkingBookings()]);
    setSpaces(s);
    setBookings(b);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const bookingCount = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bookings) {
      if (!b.space_id) continue;
      m.set(b.space_id, (m.get(b.space_id) ?? 0) + 1);
    }
    return m;
  }, [bookings]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-forest">Co-working Spaces</h2>
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {(["spaces", "bookings"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors",
                view === v ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted"
              )}
            >
              {v}
              {v === "bookings" && bookings.length > 0 && (
                <span className="ml-1.5 text-xs opacity-80">({bookings.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : view === "spaces" ? (
        <SpacesTable spaces={spaces} bookingCount={bookingCount} onChange={refresh} onEdit={setEditing} />
      ) : (
        <BookingsTable bookings={bookings} onChange={refresh} />
      )}

      {editing && (
        <EditSpaceModal
          space={editing}
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

function SpacesTable({
  spaces,
  bookingCount,
  onChange,
  onEdit,
}: {
  spaces: CoworkingSpaceRow[];
  bookingCount: Map<string, number>;
  onChange: () => void;
  onEdit: (s: CoworkingSpaceRow) => void;
}) {
  const [q, setQ] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await onChange();
    setBusyId(null);
  };
  const rows = spaces.filter((s) => {
    if (!q.trim()) return true;
    return `${s.name} ${s.owner_name ?? ""} ${s.city ?? ""} ${s.phone ?? ""} ${s.status}`
      .toLowerCase()
      .includes(q.toLowerCase());
  });

  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search spaces…" className="w-full bg-transparent text-sm focus:outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{rows.length} spaces</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Space</th>
              <th className="p-3">Owner</th>
              <th className="p-3">City</th>
              <th className="p-3">Bookings</th>
              <th className="p-3">Rating</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No spaces match.</td></tr>
            ) : (
              rows.map((s) => {
                const busy = busyId === s.id;
                return (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-forest">
                        {s.name}
                        {s.verified && <BadgeCheck className="h-3.5 w-3.5 text-gold" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{s.phone || s.email || "—"}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{s.owner_name || "—"}</td>
                    <td className="p-3 text-muted-foreground">{s.city || "—"}</td>
                    <td className="p-3 text-muted-foreground">{bookingCount.get(s.id) ?? 0}</td>
                    <td className="p-3 text-muted-foreground">{Number(s.rating).toFixed(1)}</td>
                    <td className="p-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                        s.status === "approved" ? "bg-forest-50 text-forest-600" :
                        s.status === "pending" ? "bg-gold/20 text-gold-700" :
                        s.status === "rejected" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600")}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <a href={`/coworking/${s.id}`} target="_blank" rel="noopener noreferrer" title="View" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></a>
                        <button title="Edit" onClick={() => onEdit(s)} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                        {s.status !== "approved" && <button title="Approve" disabled={busy} onClick={() => act(s.id, () => setCoworkingStatus(s.id, "approved"))} className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600 hover:bg-forest-100"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                        {s.status !== "rejected" && <button title="Reject" disabled={busy} onClick={() => act(s.id, () => setCoworkingStatus(s.id, "rejected"))} className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"><XCircle className="h-3.5 w-3.5" /></button>}
                        <button title={s.verified ? "Unverify" : "Verify"} disabled={busy} onClick={() => act(s.id, () => setCoworkingVerified(s.id, !s.verified))} className={cn("rounded-md border p-1.5", s.verified ? "border-gold/40 bg-gold/15 text-gold-700" : "border-border text-forest hover:bg-muted")}><BadgeCheck className="h-3.5 w-3.5" /></button>
                        {s.status !== "suspended" && <button title="Suspend" disabled={busy} onClick={() => act(s.id, () => setCoworkingStatus(s.id, "suspended"))} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Ban className="h-3.5 w-3.5" /></button>}
                        <button title="Delete" disabled={busy} onClick={() => { if (window.confirm(`Delete “${s.name}”?`)) act(s.id, () => deleteCoworking(s.id)); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
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

function BookingsTable({
  bookings,
  onChange,
}: {
  bookings: CoworkingBookingRow[];
  onChange: () => void;
}) {
  const [q, setQ] = React.useState("");
  const rows = bookings.filter((b) =>
    !q.trim() ||
    `${b.space_name ?? ""} ${b.customer_name ?? ""} ${b.customer_phone ?? ""} ${b.status} ${b.plan_type ?? ""}`
      .toLowerCase()
      .includes(q.toLowerCase())
  );
  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bookings…" className="w-full bg-transparent text-sm focus:outline-none" />
        <button onClick={onChange} className="shrink-0 text-xs font-semibold text-forest-600 underline">Refresh</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Space</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Start</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No bookings match.</td></tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id} className="border-b border-border/60">
                  <td className="p-3 font-semibold text-forest">{b.space_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{b.customer_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{b.customer_phone || "—"}</td>
                  <td className="p-3 text-muted-foreground">{planName(b.plan_type || "")}</td>
                  <td className="p-3 text-muted-foreground">{b.start_date || "—"}</td>
                  <td className="p-3 capitalize text-muted-foreground">{b.status}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditSpaceModal({
  space,
  onClose,
  onSaved,
}: {
  space: CoworkingSpaceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = React.useState({
    name: space.name,
    owner_name: space.owner_name ?? "",
    phone: space.phone ?? "",
    whatsapp: space.whatsapp ?? "",
    email: space.email ?? "",
    city: space.city ?? "",
    address: space.address ?? "",
    opening_hours: space.opening_hours ?? "",
    wifi_speed: space.wifi_speed ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    await updateCoworking(space.id, {
      name: f.name.trim(),
      owner_name: f.owner_name.trim() || null,
      phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      email: f.email.trim() || null,
      city: f.city.trim() || null,
      address: f.address.trim() || null,
      opening_hours: f.opening_hours.trim() || null,
      wifi_speed: f.wifi_speed.trim() || null,
    });
    setSaving(false);
    onSaved();
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-premium-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-forest">Edit space</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-forest"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <L label="Name"><input className="auth-input" value={f.name} onChange={(e) => set("name", e.target.value)} /></L>
          <L label="Owner name"><input className="auth-input" value={f.owner_name} onChange={(e) => set("owner_name", e.target.value)} /></L>
          <L label="Phone"><input className="auth-input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></L>
          <L label="WhatsApp"><input className="auth-input" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></L>
          <L label="Email"><input className="auth-input" value={f.email} onChange={(e) => set("email", e.target.value)} /></L>
          <L label="City"><input className="auth-input" value={f.city} onChange={(e) => set("city", e.target.value)} /></L>
          <L label="Address"><input className="auth-input" value={f.address} onChange={(e) => set("address", e.target.value)} /></L>
          <L label="Hours"><input className="auth-input" value={f.opening_hours} onChange={(e) => set("opening_hours", e.target.value)} /></L>
          <L label="WiFi speed"><input className="auth-input" value={f.wifi_speed} onChange={(e) => set("wifi_speed", e.target.value)} /></L>
        </div>
        <div className="mt-4 flex justify-end gap-2">
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
