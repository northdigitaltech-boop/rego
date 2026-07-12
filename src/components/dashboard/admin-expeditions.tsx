"use client";

import * as React from "react";
import { Loader2, Check, X, ShieldCheck, Star, Trash2, Plus, Mountain, Users, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getAllCompanies, getAllPros, setCompanyStatus, setCompanyVerified, setCompanyFeatured,
  setProStatus, setProVerified, setProFeatured,
  getRoles, getPeaks, getRoutes, saveRole, deleteRole, savePeak, deletePeak, saveRoute, deleteRoute,
  type ExpeditionCompanyRow, type ExpeditionProRow, type ExpeditionRole, type ExpeditionPeak, type ExpeditionRoute,
} from "@/lib/expeditions";

type Sub = "companies" | "professionals" | "roles" | "peaks" | "routes";
const SUBS: { id: Sub; label: string; icon: typeof Building2 }[] = [
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "professionals", label: "Professionals", icon: Users },
  { id: "roles", label: "Roles", icon: Users },
  { id: "peaks", label: "Peaks", icon: Mountain },
  { id: "routes", label: "Routes", icon: Mountain },
];

export function AdminExpeditions() {
  const [sub, setSub] = React.useState<Sub>("companies");
  const [companies, setCompanies] = React.useState<ExpeditionCompanyRow[]>([]);
  const [pros, setPros] = React.useState<ExpeditionProRow[]>([]);
  const [roles, setRoles] = React.useState<ExpeditionRole[]>([]);
  const [peaks, setPeaks] = React.useState<ExpeditionPeak[]>([]);
  const [routes, setRoutes] = React.useState<ExpeditionRoute[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const [c, p, r, pk, rt] = await Promise.all([
      getAllCompanies(), getAllPros(), getRoles(false), getPeaks(false), getRoutes(false),
    ]);
    setCompanies(c); setPros(p); setRoles(r); setPeaks(pk); setRoutes(rt); setLoading(false);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  if (loading) return <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-forest-600" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Mountaineering &amp; Expeditions</h2>
        <p className="text-sm text-muted-foreground">Approve providers, verify credentials, and manage peaks, routes and roles.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {SUBS.map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)}
            className={"inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 " +
              (sub === s.id ? "border-forest-600 text-forest" : "border-transparent text-muted-foreground hover:text-forest")}>
            <s.icon className="h-4 w-4" /> {s.label}
          </button>
        ))}
      </div>

      {sub === "companies" && <ProviderList kind="company" rows={companies} onRefresh={load} />}
      {sub === "professionals" && <ProviderList kind="pro" rows={pros} onRefresh={load} />}
      {sub === "roles" && <RefList kind="roles" items={roles} onRefresh={load} />}
      {sub === "peaks" && <RefList kind="peaks" items={peaks} onRefresh={load} />}
      {sub === "routes" && <RefList kind="routes" items={routes} onRefresh={load} />}
    </div>
  );
}

/* ---------------- provider approval list (companies + pros) ---------------- */
function ProviderList({ kind, rows, onRefresh }: { kind: "company" | "pro"; rows: (ExpeditionCompanyRow | ExpeditionProRow)[]; onRefresh: () => void }) {
  const [filter, setFilter] = React.useState<"all" | "pending" | "approved">("pending");
  const shown = rows.filter((r) => filter === "all" || r.status === filter);
  const isCo = kind === "company";

  const act = async (id: string, fn: () => Promise<unknown>) => { await fn(); onRefresh(); };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {(["pending", "approved", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={"rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors " + (filter === f ? "bg-forest-600 text-white" : "border border-border bg-white text-forest hover:bg-muted")}>
            {f}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 py-10 text-center text-sm text-muted-foreground">No {filter} {isCo ? "companies" : "professionals"}.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => {
            const name = isCo ? (r as ExpeditionCompanyRow).name : (r as ExpeditionProRow).full_name;
            const sub = isCo ? (r as ExpeditionCompanyRow).city : (r as ExpeditionProRow).role;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-forest">{name} {r.verified && <ShieldCheck className="inline h-4 w-4 text-gold" />} {r.featured && <Star className="inline h-4 w-4 fill-gold text-gold" />}</p>
                  <p className="text-xs text-muted-foreground">{sub || "—"} · {r.status}</p>
                </div>
                {r.status !== "approved" && (
                  <button onClick={() => act(r.id, () => isCo ? setCompanyStatus(r.id, "approved") : setProStatus(r.id, "approved"))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Check className="h-3.5 w-3.5" /> Approve</button>
                )}
                {r.status !== "rejected" && (
                  <button onClick={() => act(r.id, () => isCo ? setCompanyStatus(r.id, "rejected") : setProStatus(r.id, "rejected"))} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><X className="h-3.5 w-3.5" /> Reject</button>
                )}
                <button onClick={() => act(r.id, () => isCo ? setCompanyVerified(r.id, !r.verified) : setProVerified(r.id, !r.verified))} className={"rounded-lg px-3 py-1.5 text-xs font-semibold " + (r.verified ? "bg-gold/15 text-gold-700" : "border border-border text-forest hover:bg-muted")}>{r.verified ? "Verified" : "Verify"}</button>
                <button onClick={() => act(r.id, () => isCo ? setCompanyFeatured(r.id, !r.featured) : setProFeatured(r.id, !r.featured))} className={"rounded-lg px-3 py-1.5 text-xs font-semibold " + (r.featured ? "bg-forest-600 text-white" : "border border-border text-forest hover:bg-muted")}>{r.featured ? "Featured" : "Feature"}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- roles / peaks / routes CRUD ---------------- */
function RefList({ kind, items, onRefresh }: { kind: "roles" | "peaks" | "routes"; items: (ExpeditionRole | ExpeditionPeak | ExpeditionRoute)[]; onRefresh: () => void }) {
  const [name, setName] = React.useState("");
  const [extra, setExtra] = React.useState(""); // region (peaks/routes) or height (peaks)

  const add = async () => {
    if (!name.trim()) return;
    if (kind === "roles") await saveRole({ slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: name.trim(), display_order: items.length });
    else if (kind === "peaks") await savePeak({ name: name.trim(), region: extra || "Gilgit-Baltistan", display_order: items.length });
    else await saveRoute({ name: name.trim(), region: extra || "Gilgit-Baltistan", display_order: items.length });
    setName(""); setExtra(""); onRefresh();
  };
  const toggle = async (it: ExpeditionRole | ExpeditionPeak | ExpeditionRoute) => {
    const patch = { id: it.id, active: !it.active } as never;
    if (kind === "roles") await saveRole({ ...(it as ExpeditionRole), active: !it.active });
    else if (kind === "peaks") await savePeak({ ...(it as ExpeditionPeak), active: !it.active });
    else await saveRoute({ ...(it as ExpeditionRoute), active: !it.active });
    void patch; onRefresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    if (kind === "roles") await deleteRole(id);
    else if (kind === "peaks") await deletePeak(id);
    else await deleteRoute(id);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/60 bg-card p-3">
        <label className="flex-1"><span className="mb-1 block text-xs font-semibold text-forest">{kind === "roles" ? "Role name" : kind === "peaks" ? "Peak name" : "Route name"}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="auth-input" /></label>
        {kind !== "roles" && (
          <label className="flex-1"><span className="mb-1 block text-xs font-semibold text-forest">Region</span>
            <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Gilgit-Baltistan" className="auth-input" /></label>
        )}
        <Button variant="gold" onClick={add}><Plus className="h-4 w-4" /> Add</Button>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
            <span className="flex-1 font-medium text-forest">{it.name} {"height_m" in it && it.height_m ? <span className="text-xs text-muted-foreground">· {it.height_m} m</span> : null}</span>
            <button onClick={() => toggle(it)} className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (it.active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground")}>{it.active ? "Active" : "Hidden"}</button>
            <button onClick={() => remove(it.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-red-500 hover:bg-red-50" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
