"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
  Send,
  BadgeCheck,
  Ban,
  TriangleAlert,
  Sparkles,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ROADS,
  ROAD_STATUSES,
  ROAD_REASONS,
  ALERT_LEVELS,
  SOURCE_TYPES,
  statusLabel,
  defaultSafetyMessage,
  bannerText,
  clusterReports,
  getAllRoadUpdates,
  createRoadUpdate,
  updateRoadUpdate,
  deleteRoadUpdate,
  getAllRoadReports,
  setRoadReportStatus,
  deleteRoadReport,
  getAllReporters,
  setReporterApproved,
  deleteReporter,
  getSubscribersForRoad,
  type RoadUpdateRow,
  type RoadReportRow,
  type RoadReporterRow,
} from "@/lib/road-updates";
import { sendEmail } from "@/lib/email";
import { cn } from "@/lib/utils";

type View = "updates" | "reports" | "reporters";

export function AdminRoadUpdates() {
  const [view, setView] = React.useState<View>("updates");
  const [updates, setUpdates] = React.useState<RoadUpdateRow[]>([]);
  const [reports, setReports] = React.useState<RoadReportRow[]>([]);
  const [reporters, setReporters] = React.useState<RoadReporterRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [u, rep, r] = await Promise.all([
      getAllRoadUpdates(),
      getAllRoadReports(),
      getAllReporters(),
    ]);
    setUpdates(u);
    setReports(rep);
    setReporters(r);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const pendingReports = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-forest">Road Updates &amp; Alerts</h2>
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {([
            ["updates", "Updates"],
            ["reports", `Reports${pendingReports ? ` (${pendingReports})` : ""}`],
            ["reporters", "Reporters"],
          ] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
                view === v ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : view === "updates" ? (
        <UpdatesView updates={updates} onChange={refresh} />
      ) : view === "reports" ? (
        <ReportsView reports={reports} onChange={refresh} />
      ) : (
        <ReportersView reporters={reporters} onChange={refresh} />
      )}
    </div>
  );
}

/* ---------------- Updates ---------------- */

function UpdatesView({ updates, onChange }: { updates: RoadUpdateRow[]; onChange: () => void }) {
  const [roadKey, setRoadKey] = React.useState<string>(ROADS[0].key);
  const [status, setStatus] = React.useState("open");
  const [location, setLocation] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [safety, setSafety] = React.useState("");
  const [alertLevel, setAlertLevel] = React.useState("low");
  const [expected, setExpected] = React.useState("");
  const [altRoute, setAltRoute] = React.useState("");
  const [sourceName, setSourceName] = React.useState("");
  const [sourceLink, setSourceLink] = React.useState("");
  const [sourceType, setSourceType] = React.useState("official");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote("");
    const road = ROADS.find((r) => r.key === roadKey)!;
    const payload = {
      road_key: roadKey,
      road_name: road.name,
      location: location.trim() || null,
      status,
      reason: reason || null,
      description: description.trim() || null,
      safety_message: safety.trim() || defaultSafetyMessage(status),
      source_name: sourceName.trim() || null,
      source_link: sourceLink.trim() || null,
      source_type: sourceType,
      verified: true,
      alert_level: alertLevel,
      expected_opening_time: expected.trim() || null,
      alternative_route: altRoute.trim() || null,
    };
    const { data, error } = await createRoadUpdate(payload);
    if (error) {
      setNote("Could not post update.");
      setBusy(false);
      return;
    }

    // Notify route subscribers when the road is blocked or opened.
    if (status === "blocked" || status === "open") {
      const subs = await getSubscribersForRoad(roadKey);
      const banner = bannerText({ ...(payload as unknown as RoadUpdateRow), road_name: road.name });
      await Promise.all(
        subs.map((email) =>
          sendEmail(
            email,
            status === "open"
              ? `✅ ${road.name} is OPEN — Rego road alert`
              : `⚠️ ${road.name} BLOCKED — Rego road alert`,
            `<p>${banner}</p>` +
              (location ? `<p><strong>Location:</strong> ${location}</p>` : "") +
              (altRoute ? `<p><strong>Alternative route:</strong> ${altRoute}</p>` : "") +
              `<p>See live updates at /roadside/updates</p>`
          ).catch(() => {})
        )
      );
      setNote(`Posted. Alerted ${subs.length} subscriber${subs.length === 1 ? "" : "s"}.`);
    } else {
      setNote("Update posted.");
    }

    // reset a few fields
    setLocation("");
    setDescription("");
    setBusy(false);
    void data;
    onChange();
  };

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await onChange();
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      {/* Post form */}
      <form onSubmit={post} className="rounded-3xl border border-border bg-card p-5 shadow-premium">
        <h3 className="font-display text-base font-bold text-forest">Post / update road status</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <L label="Road">
            <select className="auth-input" value={roadKey} onChange={(e) => setRoadKey(e.target.value)}>
              {ROADS.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
          </L>
          <L label="Status">
            <select className="auth-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {ROAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </L>
          <L label="Alert level">
            <select className="auth-input" value={alertLevel} onChange={(e) => setAlertLevel(e.target.value)}>
              {ALERT_LEVELS.map((a) => <option key={a} value={a} className="capitalize">{a}</option>)}
            </select>
          </L>
          <L label="Blocked location">
            <input className="auth-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. near Chilas" />
          </L>
          <L label="Reason">
            <select className="auth-input" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">—</option>
              {ROAD_REASONS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </L>
          <L label="Expected opening">
            <input className="auth-input" value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="e.g. Tomorrow 10am" />
          </L>
          <L label="Alternative route">
            <input className="auth-input" value={altRoute} onChange={(e) => setAltRoute(e.target.value)} placeholder="e.g. via Babusar" />
          </L>
          <L label="Source name">
            <input className="auth-input" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="e.g. NHA GB" />
          </L>
          <L label="Source type">
            <select className="auth-input" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {SOURCE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </L>
          <L label="Source link" full>
            <input className="auth-input" value={sourceLink} onChange={(e) => setSourceLink(e.target.value)} placeholder="https://…" />
          </L>
          <L label="Description" full>
            <textarea rows={2} className="auth-input resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
          </L>
          <L label="Safety message" full>
            <input className="auth-input" value={safety} onChange={(e) => setSafety(e.target.value)} placeholder={defaultSafetyMessage(status)} />
          </L>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" variant="gold" className="rounded-lg" disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Posting…</> : <><Send className="h-4 w-4" /> Post verified update</>}
          </Button>
          {note && <span className="text-sm font-semibold text-forest-600">{note}</span>}
        </div>
      </form>

      {/* Existing updates */}
      <div className="rounded-2xl border border-border bg-card shadow-premium">
        <div className="border-b border-border p-4 text-sm font-semibold text-forest">
          Recent updates ({updates.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Road</th>
                <th className="p-3">Status</th>
                <th className="p-3">Location</th>
                <th className="p-3">Alert</th>
                <th className="p-3">Updated</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {updates.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No updates yet.</td></tr>
              ) : (
                updates.map((u) => {
                  const busyRow = busyId === u.id;
                  return (
                    <tr key={u.id} className="border-b border-border/60">
                      <td className="p-3 font-semibold text-forest">{u.road_name}</td>
                      <td className="p-3 capitalize text-muted-foreground">{statusLabel(u.status)}</td>
                      <td className="p-3 text-muted-foreground">{u.location || "—"}</td>
                      <td className="p-3 capitalize text-muted-foreground">{u.alert_level}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(u.updated_at).toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <a href="/roadside/updates" target="_blank" rel="noopener noreferrer" title="View live" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></a>
                          <button title={u.verified ? "Unpublish" : "Publish"} disabled={busyRow} onClick={() => act(u.id, () => updateRoadUpdate(u.id, { verified: !u.verified }))} className={cn("rounded-md border p-1.5", u.verified ? "border-forest-200 bg-forest-50 text-forest-600" : "border-border text-forest hover:bg-muted")}><BadgeCheck className="h-3.5 w-3.5" /></button>
                          <button title="Delete" disabled={busyRow} onClick={() => { if (window.confirm("Delete this update?")) act(u.id, () => deleteRoadUpdate(u.id)); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
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
    </div>
  );
}

/* ---------------- Reports (with AI clustering) ---------------- */

function ReportsView({ reports, onChange }: { reports: RoadReportRow[]; onChange: () => void }) {
  const [q, setQ] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const clusters = React.useMemo(() => clusterReports(reports), [reports]);
  const highPriority = clusters.filter((c) => c.highPriority);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await onChange();
    setBusyId(null);
  };

  const rows = reports.filter((r) =>
    !q.trim() ||
    `${r.road_name} ${r.location ?? ""} ${r.reason ?? ""} ${r.reporter_name ?? ""} ${r.reporter_email} ${r.status}`
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* AI high-priority banner */}
      {highPriority.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 font-semibold text-red-700">
            <Sparkles className="h-4 w-4" /> High-priority alerts detected
          </div>
          <p className="mt-1 text-sm text-red-700/90">
            Multiple reports cluster on the same location — likely a real blockage. Review and post an official update.
          </p>
          <div className="mt-3 space-y-1.5">
            {highPriority.map((c) => (
              <div key={`${c.road_key}-${c.location}`} className="flex items-center gap-2 text-sm text-red-800">
                <TriangleAlert className="h-4 w-4" />
                <strong>{c.road_name}</strong> near <strong>{c.location}</strong> — {c.total} reports
                {c.trusted > 0 && <span className="text-red-600"> ({c.trusted} trusted)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card shadow-premium">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports…" className="w-full bg-transparent text-sm focus:outline-none" />
          <span className="shrink-0 text-xs text-muted-foreground">{rows.length} reports</span>
        </div>
        <div className="divide-y divide-border/60">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">No reports.</p>
          ) : (
            rows.map((r) => {
              const busyRow = busyId === r.id;
              return (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-forest">{r.road_name}</span>
                      {r.trusted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-bold text-forest-600">
                          <BadgeCheck className="h-3 w-3 text-gold" /> Trusted
                        </span>
                      )}
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                        r.status === "verified" ? "bg-green-50 text-green-700" :
                        r.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700")}>
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.location || "—"} · {r.reason || "—"} · {r.reporter_name || r.reporter_email} ·{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                    {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                    {(r.media?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.media!.slice(0, 4).map((m, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={m} alt="" className="h-16 w-16 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {r.status !== "verified" && (
                      <button title="Verify" disabled={busyRow} onClick={() => act(r.id, () => setRoadReportStatus(r.id, "verified"))} className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600 hover:bg-forest-100"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                    )}
                    {r.status !== "rejected" && (
                      <button title="Reject" disabled={busyRow} onClick={() => act(r.id, () => setRoadReportStatus(r.id, "rejected"))} className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"><XCircle className="h-3.5 w-3.5" /></button>
                    )}
                    <button title="Delete" disabled={busyRow} onClick={() => { if (window.confirm("Delete this report?")) act(r.id, () => deleteRoadReport(r.id)); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Reporters ---------------- */

function ReportersView({ reporters, onChange }: { reporters: RoadReporterRow[]; onChange: () => void }) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await onChange();
    setBusyId(null);
  };
  return (
    <div className="rounded-2xl border border-border bg-card shadow-premium">
      <div className="border-b border-border p-4 text-sm font-semibold text-forest">
        Trusted reporters ({reporters.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Reporter</th>
              <th className="p-3">Region</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reporters.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No applications yet.</td></tr>
            ) : (
              reporters.map((r) => {
                const busyRow = busyId === r.id;
                return (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="p-3">
                      <p className="font-semibold text-forest">{r.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.region || "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.phone || "—"}</td>
                    <td className="p-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", r.approved ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
                        {r.approved ? "Approved" : "Pending"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        {!r.approved ? (
                          <button title="Approve" disabled={busyRow} onClick={() => act(r.id, () => setReporterApproved(r.id, true))} className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600 hover:bg-forest-100"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                        ) : (
                          <button title="Revoke" disabled={busyRow} onClick={() => act(r.id, () => setReporterApproved(r.id, false))} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Ban className="h-3.5 w-3.5" /></button>
                        )}
                        <button title="Delete" disabled={busyRow} onClick={() => { if (window.confirm("Delete this reporter?")) act(r.id, () => deleteReporter(r.id)); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
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

function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={cn("block", full && "sm:col-span-2 lg:col-span-3")}>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
