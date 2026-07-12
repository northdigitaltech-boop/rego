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
  Eye,
  ExternalLink,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getAllRoadsideProviders,
  getAllProviderServices,
  getAllRoadsideRequests,
  setRoadsideProviderStatus,
  setRoadsideProviderVerified,
  deleteRoadsideProvider,
  updateRoadsideProvider,
  serviceName,
  requestStatusLabel,
  type RoadsideProviderRow,
  type RoadsideServiceRow,
  type RoadsideRequestRow,
} from "@/lib/roadside";
import { cn } from "@/lib/utils";

type View = "providers" | "requests";

export function AdminRoadside() {
  const [view, setView] = React.useState<View>("providers");
  const [providers, setProviders] = React.useState<RoadsideProviderRow[]>([]);
  const [svcRows, setSvcRows] = React.useState<RoadsideServiceRow[]>([]);
  const [requests, setRequests] = React.useState<RoadsideRequestRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<RoadsideProviderRow | null>(null);
  const [viewingReq, setViewingReq] = React.useState<RoadsideRequestRow | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [p, s, r] = await Promise.all([
      getAllRoadsideProviders(),
      getAllProviderServices(),
      getAllRoadsideRequests(),
    ]);
    setProviders(p);
    setSvcRows(s);
    setRequests(r);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const servicesByProvider = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of svcRows) {
      if (!s.provider_id) continue;
      const arr = m.get(s.provider_id) ?? [];
      arr.push(serviceName(s.service_type));
      m.set(s.provider_id, arr);
    }
    return m;
  }, [svcRows]);

  const requestCountByProvider = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of requests) {
      if (!r.provider_id) continue;
      m.set(r.provider_id, (m.get(r.provider_id) ?? 0) + 1);
    }
    return m;
  }, [requests]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-forest">Roadside Assistance</h2>
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {(["providers", "requests"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors",
                view === v ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted"
              )}
            >
              {v}
              {v === "requests" && requests.length > 0 && (
                <span className="ml-1.5 text-xs opacity-80">({requests.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : view === "providers" ? (
        <ProvidersTable
          providers={providers}
          servicesByProvider={servicesByProvider}
          requestCountByProvider={requestCountByProvider}
          onChange={refresh}
          onEdit={setEditing}
        />
      ) : (
        <RequestsTable requests={requests} onView={setViewingReq} onChange={refresh} />
      )}

      {editing && (
        <EditProviderModal
          provider={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {viewingReq && (
        <RequestDetailModal request={viewingReq} onClose={() => setViewingReq(null)} />
      )}
    </div>
  );
}

/* ---------------- Providers ---------------- */

function ProvidersTable({
  providers,
  servicesByProvider,
  requestCountByProvider,
  onChange,
  onEdit,
}: {
  providers: RoadsideProviderRow[];
  servicesByProvider: Map<string, string[]>;
  requestCountByProvider: Map<string, number>;
  onChange: () => void;
  onEdit: (p: RoadsideProviderRow) => void;
}) {
  const [q, setQ] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await onChange();
    setBusyId(null);
  };

  const rows = providers.filter((p) => {
    if (!q.trim()) return true;
    const hay = `${p.business_name} ${p.owner_name ?? ""} ${p.city ?? ""} ${p.phone ?? ""} ${p.status}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search providers by name, owner, city, phone…"
          className="w-full bg-transparent text-sm focus:outline-none"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{rows.length} providers</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Provider</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Services</th>
              <th className="p-3">Phone</th>
              <th className="p-3">City</th>
              <th className="p-3">Requests</th>
              <th className="p-3">Rating</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No providers match.
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const busy = busyId === p.id;
                return (
                  <tr key={p.id} className="border-b border-border/60 align-top">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-forest">
                        {p.business_name}
                        {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-gold" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.whatsapp || p.email || "—"}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.owner_name || "—"}</td>
                    <td className="p-3">
                      <div className="flex max-w-[180px] flex-wrap gap-1">
                        {(servicesByProvider.get(p.id) ?? []).map((s) => (
                          <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-forest">
                            {s}
                          </span>
                        ))}
                        {(servicesByProvider.get(p.id) ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.phone || "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.city || "—"}</td>
                    <td className="p-3 text-muted-foreground">{requestCountByProvider.get(p.id) ?? 0}</td>
                    <td className="p-3 text-muted-foreground">{Number(p.rating).toFixed(1)}</td>
                    <td className="p-3">
                      <ProviderStatusBadge status={p.status} />
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <a
                          href={`/roadside/provider/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View public profile"
                          className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button title="Edit" onClick={() => onEdit(p)} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {p.status !== "approved" && (
                          <button title="Approve" disabled={busy} onClick={() => act(p.id, () => setRoadsideProviderStatus(p.id, "approved"))} className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600 hover:bg-forest-100">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {p.status !== "rejected" && (
                          <button title="Reject" disabled={busy} onClick={() => act(p.id, () => setRoadsideProviderStatus(p.id, "rejected"))} className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100">
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button title={p.verified ? "Unverify" : "Verify"} disabled={busy} onClick={() => act(p.id, () => setRoadsideProviderVerified(p.id, !p.verified))} className={cn("rounded-md border p-1.5", p.verified ? "border-gold/40 bg-gold/15 text-gold-700" : "border-border text-forest hover:bg-muted")}>
                          <BadgeCheck className="h-3.5 w-3.5" />
                        </button>
                        {p.status !== "suspended" && (
                          <button title="Suspend" disabled={busy} onClick={() => act(p.id, () => setRoadsideProviderStatus(p.id, "suspended"))} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted">
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          title="Delete"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Delete "${p.business_name}"? This cannot be undone.`)) {
                              act(p.id, () => deleteRoadsideProvider(p.id));
                            }
                          }}
                          className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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

/* ---------------- Requests ---------------- */

function RequestsTable({
  requests,
  onView,
  onChange,
}: {
  requests: RoadsideRequestRow[];
  onView: (r: RoadsideRequestRow) => void;
  onChange: () => void;
}) {
  const [q, setQ] = React.useState("");
  const rows = requests.filter((r) => {
    if (!q.trim()) return true;
    const hay = `${r.request_number ?? ""} ${r.customer_name ?? ""} ${r.customer_phone ?? ""} ${r.provider_name ?? ""} ${r.status} ${r.service_type ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search requests by number, customer, provider, status…"
          className="w-full bg-transparent text-sm focus:outline-none"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{rows.length} requests</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Request</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Service</th>
              <th className="p-3">Provider</th>
              <th className="p-3">Urgency</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">View</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No requests match.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="p-3 font-semibold tracking-wider text-forest">{r.request_number}</td>
                  <td className="p-3 text-muted-foreground">{r.customer_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{r.customer_phone || "—"}</td>
                  <td className="p-3 text-muted-foreground">{serviceName(r.service_type || "")}</td>
                  <td className="p-3 text-muted-foreground">{r.provider_name || "—"}</td>
                  <td className="p-3 capitalize text-muted-foreground">{r.urgency}</td>
                  <td className="p-3"><ReqStatusBadge status={r.status} /></td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => onView(r)} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border p-3 text-xs text-muted-foreground">
        Admin view is read-only for request status — providers update their own request status. Use{" "}
        {/* keep onChange referenced for future admin actions */}
        <button onClick={onChange} className="font-semibold text-forest-600 underline">
          refresh
        </button>{" "}
        to reload.
      </p>
    </div>
  );
}

/* ---------------- Edit provider modal ---------------- */

function EditProviderModal({
  provider,
  onClose,
  onSaved,
}: {
  provider: RoadsideProviderRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = React.useState({
    business_name: provider.business_name,
    owner_name: provider.owner_name ?? "",
    phone: provider.phone ?? "",
    whatsapp: provider.whatsapp ?? "",
    email: provider.email ?? "",
    city: provider.city ?? "",
    address: provider.address ?? "",
    response_time: provider.response_time ?? "",
    description: provider.description ?? "",
  });
  const [is247, setIs247] = React.useState(provider.is_24_7);
  const [availability, setAvailability] = React.useState(provider.availability_status);
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    await updateRoadsideProvider(provider.id, {
      business_name: f.business_name.trim(),
      owner_name: f.owner_name.trim() || null,
      phone: f.phone.trim() || null,
      whatsapp: f.whatsapp.trim() || null,
      email: f.email.trim() || null,
      city: f.city.trim() || null,
      address: f.address.trim() || null,
      response_time: f.response_time.trim() || null,
      description: f.description.trim() || null,
      is_24_7: is247,
      availability_status: availability,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-premium-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-forest">Edit provider</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-forest">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <L label="Business name"><input className="auth-input" value={f.business_name} onChange={(e) => set("business_name", e.target.value)} /></L>
          <L label="Owner name"><input className="auth-input" value={f.owner_name} onChange={(e) => set("owner_name", e.target.value)} /></L>
          <L label="Phone"><input className="auth-input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></L>
          <L label="WhatsApp"><input className="auth-input" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></L>
          <L label="Email"><input className="auth-input" value={f.email} onChange={(e) => set("email", e.target.value)} /></L>
          <L label="City"><input className="auth-input" value={f.city} onChange={(e) => set("city", e.target.value)} /></L>
          <L label="Address"><input className="auth-input" value={f.address} onChange={(e) => set("address", e.target.value)} /></L>
          <L label="Response time"><input className="auth-input" value={f.response_time} onChange={(e) => set("response_time", e.target.value)} /></L>
          <L label="Availability">
            <select className="auth-input" value={availability} onChange={(e) => setAvailability(e.target.value)}>
              <option value="available">Available</option>
              <option value="offline">Offline</option>
            </select>
          </L>
          <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-forest">
            <input type="checkbox" checked={is247} onChange={(e) => setIs247(e.target.checked)} className="h-4 w-4" /> 24/7 emergency
          </label>
        </div>
        <L label="Description" className="mt-3">
          <textarea rows={3} className="auth-input resize-none" value={f.description} onChange={(e) => set("description", e.target.value)} />
        </L>
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

/* ---------------- Request detail modal ---------------- */

function RequestDetailModal({
  request,
  onClose,
}: {
  request: RoadsideRequestRow;
  onClose: () => void;
}) {
  const r = request;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-premium-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-forest">Request {r.request_number}</h3>
            <ReqStatusBadge status={r.status} />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-forest">
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <KV k="Customer" v={r.customer_name || "—"} />
          <KV k="Phone" v={r.customer_phone || "—"} />
          <KV k="WhatsApp" v={r.customer_whatsapp || "—"} />
          <KV k="Service" v={serviceName(r.service_type || "")} />
          <KV k="Provider" v={r.provider_name || "—"} />
          <KV k="Vehicle" v={r.vehicle_type || "—"} />
          <KV k="Urgency" v={r.urgency} />
          <KV k="Preferred contact" v={r.preferred_contact_method || "—"} />
          <KV k="Location" v={r.location_address || "—"} />
          <KV k="Created" v={new Date(r.created_at).toLocaleString()} />
        </dl>
        {r.problem_description && (
          <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {r.problem_description}
          </p>
        )}
        {r.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image_url} alt="" className="mt-3 max-h-48 rounded-lg object-cover" />
        )}
      </div>
    </div>
  );
}

/* ---------------- bits ---------------- */

function L({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium capitalize text-forest">{v}</dd>
    </div>
  );
}

function ProviderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-forest-50 text-forest-600",
    pending: "bg-gold/20 text-gold-700",
    rejected: "bg-red-50 text-red-600",
    suspended: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", map[status] ?? "bg-muted")}>
      {status}
    </span>
  );
}

function ReqStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-gold/20 text-gold-700",
    accepted: "bg-forest-50 text-forest-600",
    on_the_way: "bg-blue-50 text-blue-600",
    completed: "bg-green-50 text-green-600",
    cancelled: "bg-red-50 text-red-600",
  };
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", map[status] ?? "bg-muted")}>
      {requestStatusLabel(status)}
    </span>
  );
}
