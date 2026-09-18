"use client";

import * as React from "react";
import {
  Loader2, Trash2, CheckCircle2, XCircle, BadgeCheck, Plus, Search, ExternalLink,
  Pencil, Save, EyeOff, AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { PlaceSelect, RegionDistrictPlace } from "@/components/ui/location-select";
import {
  MAP_CATEGORIES, categoryName, LINK_SERVICE_TYPES, linkedProfileUrl, ALERT_TYPES,
  getAllPlaces, createPlace, updatePlace, deletePlace, setPlaceVerified,
  getRoutes, createRoute, deleteRoute,
  getAllAlerts, createAlert, deleteAlert,
  getDistances, createDistance, deleteDistance,
  getAllReports, setReportStatus, deleteReport,
  type MapPlaceRow, type RoadRouteRow, type RoadAlertRow, type DistanceRow, type MapReportRow,
} from "@/lib/rego-map";
import { cn } from "@/lib/utils";

type Tab = "pins" | "routes" | "alerts" | "distances" | "reports";

export function AdminRegoMap() {
  const [tab, setTab] = React.useState<Tab>("pins");
  const [places, setPlaces] = React.useState<MapPlaceRow[]>([]);
  const [routes, setRoutes] = React.useState<RoadRouteRow[]>([]);
  const [alerts, setAlerts] = React.useState<RoadAlertRow[]>([]);
  const [distances, setDistances] = React.useState<DistanceRow[]>([]);
  const [reports, setReports] = React.useState<MapReportRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [p, r, a, d, rep] = await Promise.all([
      getAllPlaces(), getRoutes(), getAllAlerts(), getDistances(), getAllReports(),
    ]);
    setPlaces(p); setRoutes(r); setAlerts(a); setDistances(d); setReports(rep);
    setLoading(false);
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);

  const pendingReports = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-forest">Rego Map</h2>
        <div className="inline-flex flex-wrap rounded-xl border border-border bg-card p-1">
          {([
            ["pins", "Pins"], ["routes", "Roads"], ["alerts", "Alerts / Danger"],
            ["distances", "Distances"], ["reports", `Reports${pendingReports ? ` (${pendingReports})` : ""}`],
          ] as [Tab, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={cn("rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors", tab === v ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-forest-600" /></div>
      ) : tab === "pins" ? <PinsTab places={places} onChange={refresh} />
        : tab === "routes" ? <RoutesTab routes={routes} onChange={refresh} />
        : tab === "alerts" ? <AlertsTab alerts={alerts} onChange={refresh} />
        : tab === "distances" ? <DistancesTab distances={distances} onChange={refresh} />
        : <ReportsTab reports={reports} onChange={refresh} />}
    </div>
  );
}

/* ---------------- Pins ---------------- */

/**
 * Marker written into `source` by the phase123 seed for a pin whose exact
 * location has not been confirmed.
 *
 * WHY IT IS A STRING IN AN EXISTING COLUMN AND NOT A NEW ONE
 *   A rescue station seeded at its district's coordinates is not where the
 *   station is — it is roughly where the district is. Those rows ship
 *   unpublished, so nobody is ever navigated to them, but the admin list has
 *   to say so loudly, because the one dangerous outcome here is somebody
 *   publishing an emergency pin that points at the wrong place.
 *
 *   A column would be tidier and would need a migration, a type change and a
 *   read path in four components. This needs no schema at all and is removed
 *   by the act of correcting the pin.
 */
const PIN_UNVERIFIED = "PIN NOT VERIFIED";

const BLANK = {
  name: "", category: MAP_CATEGORIES[0].slug, region: "", district: "", city: "", latitude: "", longitude: "",
  description: "", contact_number: "", status: "open", source: "",
};

function PinsTab({ places, onChange }: { places: MapPlaceRow[]; onChange: () => void }) {
  const [f, setF] = React.useState(BLANK);
  const [photo, setPhoto] = React.useState("");
  const [verified, setVerified] = React.useState(false);
  const [linked, setLinked] = React.useState(false);
  const [linkType, setLinkType] = React.useState<string>(LINK_SERVICE_TYPES[0].type);
  const [linkId, setLinkId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  /** The pin being changed, or null when the form is adding a new one. */
  const [editing, setEditing] = React.useState<MapPlaceRow | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const reset = () => {
    setEditing(null);
    setF(BLANK);
    setPhoto("");
    setVerified(false);
    setLinked(false);
    setLinkId("");
    setNote("");
  };

  const startEdit = (p: MapPlaceRow) => {
    setEditing(p);
    setF({
      name: p.name,
      category: p.category,
      region: p.region ?? "",
      district: p.district ?? "",
      city: p.city ?? "",
      /* Full precision, not rounded for display. The table shows three decimals
         — saving that back would move a pin by up to a hundred metres every
         time somebody opened it to fix a phone number. */
      latitude: String(p.latitude),
      longitude: String(p.longitude),
      description: p.description ?? "",
      contact_number: p.contact_number ?? "",
      status: p.status,
      source: p.source ?? "",
    });
    setPhoto(p.photos?.[0] ?? "");
    setVerified(p.is_verified);
    setLinked(p.is_linked_service);
    setLinkType(p.linked_service_type || LINK_SERVICE_TYPES[0].type);
    setLinkId(p.linked_service_id ?? "");
    setNote("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* Stable, because RegionDistrictPlace backfills the region from a saved
     district inside an effect that depends on this callback. A fresh function
     every render would re-run that effect every render. */
  const setPlace = React.useCallback(
    (v: { region: string; district: string; place: string }) =>
      setF((p) => ({ ...p, region: v.region, district: v.district, city: v.place })),
    []
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.latitude || !f.longitude) { setNote("Name, latitude and longitude are required."); return; }
    if (!Number.isFinite(Number(f.latitude)) || !Number.isFinite(Number(f.longitude))) {
      setNote("Latitude and longitude must be numbers.");
      return;
    }
    setBusy(true); setNote("");
    const linked_profile_url = linked ? linkedProfileUrl(linkType, linkId.trim()) : null;
    const payload = {
      name: f.name.trim(), category: f.category,
      region: f.region.trim() || null, district: f.district.trim() || null, city: f.city.trim() || null,
      latitude: Number(f.latitude), longitude: Number(f.longitude), description: f.description.trim() || null,
      contact_number: f.contact_number.trim() || null, status: f.status, is_verified: verified,
      source: f.source.trim() || null, photos: photo ? [photo] : null,
      is_linked_service: linked, linked_service_type: linked ? linkType : null,
      linked_service_id: linked ? linkId.trim() || null : null, linked_profile_url,
    };

    const { error } = editing
      ? await updatePlace(editing.id, payload)
      : await createPlace(payload);
    setBusy(false);
    if (error) { setNote(editing ? "Could not save changes." : "Could not save pin."); return; }

    if (editing) {
      reset();
      setNote("Pin updated.");
    } else {
      /* District and city survive, because adding several pins in one district
         is the normal way this form gets used. */
      setF({ ...f, name: "", latitude: "", longitude: "", description: "", contact_number: "" });
      setPhoto(""); setLinkId(""); setNote("Pin added.");
    }
    onChange();
  };

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>) => { setBusyId(id); await fn(); await onChange(); setBusyId(null); };
  const [q, setQ] = React.useState("");
  const rows = places.filter((p) => !q.trim() || `${p.name} ${categoryName(p.category)} ${p.district ?? ""} ${p.city ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <form
        ref={formRef}
        onSubmit={submit}
        className={cn(
          "rounded-3xl border bg-card p-5 shadow-premium",
          editing ? "border-gold/60 ring-1 ring-gold/30" : "border-border"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-forest">
            {editing ? `Edit “${editing.name}”` : "Add map pin"}
          </h3>
          {editing && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-forest hover:bg-muted"
            >
              Cancel — add a new pin instead
            </button>
          )}
        </div>
        {editing && editing.source?.includes(PIN_UNVERIFIED) && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This pin sits at the district’s coordinates, not at the place itself — it was
              recorded without a confirmed location. Replace the latitude and longitude with the
              real ones, clear the “{PIN_UNVERIFIED}” note from Source, then publish it.
            </span>
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <L label="Name"><input className="auth-input" value={f.name} onChange={(e) => set("name", e.target.value)} /></L>
          <L label="Category"><select className="auth-input" value={f.category} onChange={(e) => set("category", e.target.value)}>{MAP_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></L>
          <L label="Status"><select className="auth-input" value={f.status} onChange={(e) => set("status", e.target.value)}><option value="open">Open</option><option value="closed">Closed</option><option value="seasonal">Seasonal</option></select></L>
          {/* Chosen from the places Rego already knows about, so the map's
              district filter matches every pin instead of most of them. */}
          <RegionDistrictPlace
            value={{ region: f.region, district: f.district, place: f.city }}
            onChange={setPlace}
          />
          <L label="Contact number"><input className="auth-input" value={f.contact_number} onChange={(e) => set("contact_number", e.target.value)} /></L>
          <L label="Latitude"><input className="auth-input" value={f.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="35.29" /></L>
          <L label="Longitude"><input className="auth-input" value={f.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="75.63" /></L>
          <L label="Source"><input className="auth-input" value={f.source} onChange={(e) => set("source", e.target.value)} /></L>
          <L label="Description" full><textarea rows={2} className="auth-input resize-none" value={f.description} onChange={(e) => set("description", e.target.value)} /></L>
          <L label="Photo" full><ImageUpload value={photo} onChange={setPhoto} /></L>
        </div>

        {/* Link with existing service */}
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-forest">
          <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} /> Link with existing Rego service (no duplicate)
        </label>
        {linked && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <L label="Service type"><select className="auth-input" value={linkType} onChange={(e) => setLinkType(e.target.value)}>{LINK_SERVICE_TYPES.map((s) => <option key={s.type} value={s.type}>{s.label}</option>)}</select></L>
            <L label="Existing service ID (from its profile URL)"><input className="auth-input" value={linkId} onChange={(e) => setLinkId(e.target.value)} placeholder="uuid" /></L>
            {linkId && <p className="text-xs text-muted-foreground sm:col-span-2">Links to: <span className="font-mono text-forest">{linkedProfileUrl(linkType, linkId.trim()) ?? "—"}</span></p>}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-forest">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> Verified
          </label>
          <Button type="submit" variant="gold" className="rounded-lg" disabled={busy}>
            {busy
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : editing
                ? <><Save className="h-4 w-4" /> Save changes</>
                : <><Plus className="h-4 w-4" /> Add pin</>}
          </Button>
          {note && <span className="text-sm font-semibold text-forest-600">{note}</span>}
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card shadow-premium">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pins…" className="w-full bg-transparent text-sm focus:outline-none" />
          <span className="shrink-0 text-xs text-muted-foreground">{rows.length} pins</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Pin</th><th className="p-3">Category</th><th className="p-3">District</th><th className="p-3">Linked</th><th className="p-3 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No pins yet.</td></tr> : rows.map((p) => {
                const busyRow = busyId === p.id;
                return (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-forest">{p.name}{p.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-gold" />}</div>
                      <p className="text-xs text-muted-foreground">{p.latitude.toFixed(3)}, {p.longitude.toFixed(3)}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{categoryName(p.category)}</td>
                    <td className="p-3 text-muted-foreground">{p.district || "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.is_linked_service ? <a href={p.linked_profile_url ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-forest-600 underline"><ExternalLink className="h-3 w-3" /> {p.linked_service_type}</a> : "—"}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button title={p.is_verified ? "Unverify" : "Verify"} disabled={busyRow} onClick={() => act(p.id, () => setPlaceVerified(p.id, !p.is_verified))} className={cn("rounded-md border p-1.5", p.is_verified ? "border-gold/40 bg-gold/15 text-gold-700" : "border-border text-forest hover:bg-muted")}><BadgeCheck className="h-3.5 w-3.5" /></button>
                        <button title={p.published ? "Hide" : "Publish"} disabled={busyRow} onClick={() => act(p.id, () => updatePlace(p.id, { published: !p.published }))} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted">{p.published ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}</button>
                        <button title="Delete" disabled={busyRow} onClick={() => { if (confirm(`Delete “${p.name}”?`)) act(p.id, () => deletePlace(p.id)); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Roads ---------------- */
function RoutesTab({ routes, onChange }: { routes: RoadRouteRow[]; onChange: () => void }) {
  const [f, setF] = React.useState({ road_name: "", start_point: "", end_point: "", distance_km: "", estimated_time: "", road_type: "highway", difficulty: "moderate", status: "open", risk_level: "low" });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.road_name.trim()) return;
    setBusy(true);
    await createRoute({ road_name: f.road_name.trim(), start_point: f.start_point.trim() || null, end_point: f.end_point.trim() || null, distance_km: f.distance_km ? Number(f.distance_km) : null, estimated_time: f.estimated_time.trim() || null, road_type: f.road_type, difficulty: f.difficulty, status: f.status, risk_level: f.risk_level });
    setBusy(false); setF({ ...f, road_name: "", start_point: "", end_point: "", distance_km: "", estimated_time: "" }); onChange();
  };
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const del = async (id: string) => { setBusyId(id); await deleteRoute(id); await onChange(); setBusyId(null); };
  return (
    <div className="space-y-5">
      <form onSubmit={add} className="rounded-3xl border border-border bg-card p-5 shadow-premium">
        <h3 className="font-display text-base font-bold text-forest">Add / update road</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <L label="Road name"><input className="auth-input" value={f.road_name} onChange={(e) => set("road_name", e.target.value)} /></L>
          <PlaceSelect label="Start" value={f.start_point} onChange={(v) => set("start_point", v)} />
          <PlaceSelect label="End" value={f.end_point} onChange={(v) => set("end_point", v)} />
          <L label="Distance (km)"><input className="auth-input" value={f.distance_km} onChange={(e) => set("distance_km", e.target.value)} /></L>
          <L label="Estimated time"><input className="auth-input" value={f.estimated_time} onChange={(e) => set("estimated_time", e.target.value)} placeholder="6–7 h" /></L>
          <L label="Road type"><select className="auth-input" value={f.road_type} onChange={(e) => set("road_type", e.target.value)}><option>highway</option><option>metalled</option><option>jeep-track</option><option>unpaved</option></select></L>
          <L label="Difficulty"><select className="auth-input" value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}><option>easy</option><option>moderate</option><option>hard</option><option>extreme</option></select></L>
          <L label="Status"><select className="auth-input" value={f.status} onChange={(e) => set("status", e.target.value)}><option value="open">Open</option><option value="partial">Partially open</option><option value="risky">Risky</option><option value="blocked">Blocked</option><option value="snow-blocked">Snow blocked</option><option value="clearance">Under clearance</option></select></L>
          <L label="Risk level"><select className="auth-input" value={f.risk_level} onChange={(e) => set("risk_level", e.target.value)}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></L>
        </div>
        <Button type="submit" variant="gold" className="mt-4 rounded-lg" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add road</>}</Button>
      </form>
      <SimpleTable rows={routes} cols={["road_name", "distance_km", "status", "risk_level"]} onDelete={del} busyId={busyId} />
    </div>
  );
}

/* ---------------- Alerts / danger zones ---------------- */
function AlertsTab({ alerts, onChange }: { alerts: RoadAlertRow[]; onChange: () => void }) {
  const [f, setF] = React.useState({ road_name: "", location: "", latitude: "", longitude: "", alert_type: ALERT_TYPES[0], reason: "", description: "", source_name: "", expected_opening_time: "", alert_level: "medium" });
  const [danger, setDanger] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    await createAlert({ road_name: f.road_name.trim() || null, location: f.location.trim() || null, latitude: f.latitude ? Number(f.latitude) : null, longitude: f.longitude ? Number(f.longitude) : null, alert_type: f.alert_type, reason: f.reason.trim() || null, description: f.description.trim() || null, source_name: f.source_name.trim() || null, expected_opening_time: f.expected_opening_time.trim() || null, alert_level: f.alert_level, is_danger_zone: danger, status: "active" });
    setBusy(false); setF({ ...f, road_name: "", location: "", latitude: "", longitude: "", reason: "", description: "" }); onChange();
  };
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const del = async (id: string) => { setBusyId(id); await deleteAlert(id); await onChange(); setBusyId(null); };
  return (
    <div className="space-y-5">
      <form onSubmit={add} className="rounded-3xl border border-border bg-card p-5 shadow-premium">
        <h3 className="font-display text-base font-bold text-forest">Add alert / danger zone</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <L label="Alert type"><select className="auth-input" value={f.alert_type} onChange={(e) => set("alert_type", e.target.value)}>{ALERT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></L>
          <L label="Road name"><input className="auth-input" value={f.road_name} onChange={(e) => set("road_name", e.target.value)} /></L>
          <PlaceSelect label="Location" value={f.location} onChange={(v) => set("location", v)} />
          <L label="Latitude"><input className="auth-input" value={f.latitude} onChange={(e) => set("latitude", e.target.value)} /></L>
          <L label="Longitude"><input className="auth-input" value={f.longitude} onChange={(e) => set("longitude", e.target.value)} /></L>
          <L label="Alert level"><select className="auth-input" value={f.alert_level} onChange={(e) => set("alert_level", e.target.value)}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></L>
          <L label="Reason"><input className="auth-input" value={f.reason} onChange={(e) => set("reason", e.target.value)} /></L>
          <L label="Expected opening"><input className="auth-input" value={f.expected_opening_time} onChange={(e) => set("expected_opening_time", e.target.value)} /></L>
          <L label="Source"><input className="auth-input" value={f.source_name} onChange={(e) => set("source_name", e.target.value)} /></L>
          <L label="Description" full><textarea rows={2} className="auth-input resize-none" value={f.description} onChange={(e) => set("description", e.target.value)} /></L>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-forest"><input type="checkbox" checked={danger} onChange={(e) => setDanger(e.target.checked)} /> Mark as danger zone</label>
        <Button type="submit" variant="gold" className="mt-4 rounded-lg" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add alert</>}</Button>
      </form>
      <SimpleTable rows={alerts} cols={["alert_type", "location", "alert_level", "status"]} onDelete={del} busyId={busyId} />
    </div>
  );
}

/* ---------------- Distances ---------------- */
function DistancesTab({ distances, onChange }: { distances: DistanceRow[]; onChange: () => void }) {
  const [f, setF] = React.useState({ from_location: "", to_location: "", distance_km: "", estimated_time: "", road_type: "highway", difficulty: "moderate", notes: "" });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f.from_location.trim() || !f.to_location.trim()) return; setBusy(true);
    await createDistance({ from_location: f.from_location.trim(), to_location: f.to_location.trim(), distance_km: f.distance_km ? Number(f.distance_km) : null, estimated_time: f.estimated_time.trim() || null, road_type: f.road_type, difficulty: f.difficulty, notes: f.notes.trim() || null });
    setBusy(false); setF({ ...f, from_location: "", to_location: "", distance_km: "", estimated_time: "", notes: "" }); onChange();
  };
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const del = async (id: string) => { setBusyId(id); await deleteDistance(id); await onChange(); setBusyId(null); };
  return (
    <div className="space-y-5">
      <form onSubmit={add} className="rounded-3xl border border-border bg-card p-5 shadow-premium">
        <h3 className="font-display text-base font-bold text-forest">Add distance</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PlaceSelect label="From" value={f.from_location} onChange={(v) => set("from_location", v)} />
          <PlaceSelect label="To" value={f.to_location} onChange={(v) => set("to_location", v)} />
          <L label="Distance (km)"><input className="auth-input" value={f.distance_km} onChange={(e) => set("distance_km", e.target.value)} /></L>
          <L label="Estimated time"><input className="auth-input" value={f.estimated_time} onChange={(e) => set("estimated_time", e.target.value)} /></L>
          <L label="Road type"><select className="auth-input" value={f.road_type} onChange={(e) => set("road_type", e.target.value)}><option>highway</option><option>metalled</option><option>jeep-track</option></select></L>
          <L label="Difficulty"><select className="auth-input" value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}><option>easy</option><option>moderate</option><option>hard</option></select></L>
          <L label="Notes" full><input className="auth-input" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></L>
        </div>
        <Button type="submit" variant="gold" className="mt-4 rounded-lg" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add</>}</Button>
      </form>
      <SimpleTable rows={distances} cols={["from_location", "to_location", "distance_km", "estimated_time"]} onDelete={del} busyId={busyId} />
    </div>
  );
}

/* ---------------- Reports ---------------- */
function ReportsTab({ reports, onChange }: { reports: MapReportRow[]; onChange: () => void }) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>) => { setBusyId(id); await fn(); await onChange(); setBusyId(null); };
  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="border-b border-border p-4 text-sm font-semibold text-forest">Traveler reports ({reports.length})</div>
      <div className="divide-y divide-border/60">
        {reports.length === 0 ? <p className="p-8 text-center text-muted-foreground">No reports.</p> : reports.map((r) => {
          const busy = busyId === r.id;
          return (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-bold capitalize text-forest">{r.report_type?.replace("-", " ")}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", r.status === "verified" ? "bg-green-50 text-green-700" : r.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700")}>{r.status}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.location_name || (r.latitude ? `${r.latitude.toFixed(3)}, ${r.longitude?.toFixed(3)}` : "—")}
                  {r.road_name ? ` · ${r.road_name}` : ""} · {r.user_name || r.user_email} · {new Date(r.created_at).toLocaleString()}
                </p>
                {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                {r.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photo} alt="" className="mt-2 h-20 w-28 rounded-lg object-cover" />
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {r.status !== "verified" && <button title="Verify" disabled={busy} onClick={() => act(r.id, () => setReportStatus(r.id, "verified"))} className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600 hover:bg-forest-100"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                {r.status !== "rejected" && <button title="Reject" disabled={busy} onClick={() => act(r.id, () => setReportStatus(r.id, "rejected"))} className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"><XCircle className="h-3.5 w-3.5" /></button>}
                <button title="Delete" disabled={busy} onClick={() => { if (confirm("Delete this report?")) act(r.id, () => deleteReport(r.id)); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SimpleTable({ rows, cols, onDelete, busyId }: { rows: any[]; cols: string[]; onDelete: (id: string) => void; busyId: string | null }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-premium">
      <table className="w-full min-w-[600px] text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          {cols.map((c) => <th key={c} className="p-3">{c.replace(/_/g, " ")}</th>)}<th className="p-3 text-right">Actions</th>
        </tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={cols.length + 1} className="p-8 text-center text-muted-foreground">Nothing yet.</td></tr> : rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60">
              {cols.map((c) => <td key={c} className="p-3 capitalize text-muted-foreground">{String(r[c] ?? "—").replace(/-/g, " ")}</td>)}
              <td className="p-3 text-right">
                <button disabled={busyId === r.id} onClick={() => { if (confirm("Delete?")) onDelete(r.id); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={cn("block", full && "sm:col-span-2 lg:col-span-3")}>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
