"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  KanbanSquare,
  CalendarClock,
  BarChart3,
  MousePointerClick,
  StickyNote,
  Search,
  Plus,
  Phone,
  MessageCircle,
  Eye,
  Loader2,
  X,
  CheckCircle2,
  Heart,
  TrendingUp,
  Wallet,
  Trash2,
  Pencil,
  Flame,
} from "lucide-react";

import { type User } from "@/components/auth/auth-context";
import { cn, formatPrice } from "@/lib/utils";
import { KpiCard, LineChart, BarRows, Donut, Empty } from "@/components/crm/charts";
import {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  getFollowups,
  createFollowup,
  updateFollowup,
  deleteFollowup,
  getNotes,
  addNote,
  deleteNote,
  getOwnerEvents,
  summarize,
  presetRange,
  inRange,
  pct,
  pipelineLabel,
  eventLabel,
  LEAD_STATUSES,
  LEAD_SOURCES,
  PIPELINE_STAGES,
  PRIORITIES,
  DATE_PRESETS,
  type DatePreset,
  type LeadRow,
  type FollowupRow,
  type NoteRow,
  type AnalyticsEventRow,
} from "@/lib/crm";

type Page =
  | "overview"
  | "leads"
  | "customers"
  | "pipeline"
  | "followups"
  | "insights"
  | "actions"
  | "notes";

const pages: { id: Page; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "CRM Overview", icon: LayoutDashboard },
  { id: "leads", label: "My Leads", icon: UserPlus },
  { id: "customers", label: "My Customers", icon: Users },
  { id: "pipeline", label: "Booking Pipeline", icon: KanbanSquare },
  { id: "followups", label: "Follow-ups", icon: CalendarClock },
  { id: "insights", label: "Listings Insights", icon: BarChart3 },
  { id: "actions", label: "Customer Actions", icon: MousePointerClick },
  { id: "notes", label: "Notes", icon: StickyNote },
];

const waLink = (n?: string | null) => {
  const d = (n ?? "").replace(/[^\d]/g, "");
  return d ? `https://wa.me/${d}` : "";
};

export function OwnerCrm({ user }: { user: User }) {
  const owner = user.email;
  const [page, setPage] = React.useState<Page>("overview");
  const [leads, setLeads] = React.useState<LeadRow[]>([]);
  const [followups, setFollowups] = React.useState<FollowupRow[]>([]);
  const [notes, setNotes] = React.useState<NoteRow[]>([]);
  const [events, setEvents] = React.useState<AnalyticsEventRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [preset, setPreset] = React.useState<DatePreset>("30d");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [l, f, n, e] = await Promise.all([
      getLeads(owner),
      getFollowups(owner),
      getNotes(owner),
      getOwnerEvents(owner),
    ]);
    setLeads(l);
    setFollowups(f);
    setNotes(n);
    setEvents(e);
    setLoading(false);
  }, [owner]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const range = React.useMemo(() => {
    if (preset === "custom") {
      return {
        start: customStart ? new Date(customStart) : null,
        end: customEnd ? new Date(new Date(customEnd).getTime() + 86400000) : null,
      };
    }
    return presetRange(preset);
  }, [preset, customStart, customEnd]);

  const filteredEvents = React.useMemo(
    () => events.filter((e) => inRange(e.created_at, range.start, range.end)),
    [events, range]
  );
  const summary = React.useMemo(() => summarize(filteredEvents), [filteredEvents]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-forest">CRM &amp; Insights</h2>
          <p className="text-sm text-muted-foreground">Your leads, customers, bookings and visit analytics.</p>
        </div>
        <DateFilter
          preset={preset}
          onPreset={setPreset}
          customStart={customStart}
          customEnd={customEnd}
          onCustom={(s, e) => {
            setCustomStart(s);
            setCustomEnd(e);
          }}
        />
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5 shadow-premium">
        {pages.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              onClick={() => setPage(p.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                page === p.id ? "bg-gradient-forest text-white" : "text-forest hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" /> {p.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {page === "overview" && (
            <Overview leads={leads} followups={followups} summary={summary} onGo={setPage} />
          )}
          {page === "leads" && <LeadsPage owner={owner} leads={leads} onChange={refresh} />}
          {page === "customers" && <CustomersPage owner={owner} leads={leads} notes={notes} onChange={refresh} />}
          {page === "pipeline" && <PipelinePage leads={leads} onChange={refresh} />}
          {page === "followups" && <FollowupsPage owner={owner} followups={followups} onChange={refresh} />}
          {page === "insights" && <InsightsPage summary={summary} />}
          {page === "actions" && <ActionsPage events={filteredEvents} summary={summary} />}
          {page === "notes" && <NotesPage owner={owner} notes={notes} onChange={refresh} />}
        </>
      )}
    </div>
  );
}

/* ================= Date filter ================= */

function DateFilter({
  preset,
  onPreset,
  customStart,
  customEnd,
  onCustom,
}: {
  preset: DatePreset;
  onPreset: (p: DatePreset) => void;
  customStart: string;
  customEnd: string;
  onCustom: (s: string, e: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={preset}
        onChange={(e) => onPreset(e.target.value as DatePreset)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-forest focus:outline-none"
      >
        {DATE_PRESETS.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>
      {preset === "custom" && (
        <>
          <input type="date" value={customStart} onChange={(e) => onCustom(e.target.value, customEnd)} className="rounded-lg border border-border bg-card px-2 py-2 text-sm" />
          <input type="date" value={customEnd} onChange={(e) => onCustom(customStart, e.target.value)} className="rounded-lg border border-border bg-card px-2 py-2 text-sm" />
        </>
      )}
    </div>
  );
}

/* ================= Overview ================= */

function Overview({
  leads,
  followups,
  summary,
  onGo,
}: {
  leads: LeadRow[];
  followups: FollowupRow[];
  summary: ReturnType<typeof summarize>;
  onGo: (p: Page) => void;
}) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const confirmed = leads.filter((l) => l.lead_status === "confirmed").length;
  const completed = leads.filter((l) => l.pipeline_stage === "completed").length;
  const lost = leads.filter((l) => l.lead_status === "lost").length;
  const pendingFollowups = followups.filter((f) => f.status === "pending").length;
  const customers = distinctCustomers(leads).length;
  const monthlyRevenue = leads
    .filter((l) => l.lead_status === "confirmed" && new Date(l.created_at).getTime() >= monthStart)
    .reduce((s, l) => s + (Number(l.amount) || Number(l.budget) || 0), 0);
  const conversion = pct(confirmed, leads.length);

  const kpis = [
    { label: "Total Leads", value: leads.length, icon: UserPlus, accent: "forest" as const },
    { label: "New Leads", value: leads.filter((l) => l.lead_status === "new").length, icon: UserPlus, accent: "blue" as const },
    { label: "Confirmed Bookings", value: confirmed, icon: CheckCircle2, accent: "green" as const },
    { label: "Pending Follow-ups", value: pendingFollowups, icon: CalendarClock, accent: "gold" as const },
    { label: "Completed Bookings", value: completed, icon: CheckCircle2, accent: "green" as const },
    { label: "Lost Leads", value: lost, icon: X, accent: "red" as const },
    { label: "Total Customers", value: customers, icon: Users, accent: "forest" as const },
    { label: "Total Profile Views", value: summary.views, icon: Eye, accent: "blue" as const },
    { label: "Total Wishlist Saves", value: summary.byType["wishlist_save"] ?? 0, icon: Heart, accent: "red" as const },
    { label: "WhatsApp Clicks", value: summary.byType["whatsapp_click"] ?? 0, icon: MessageCircle, accent: "green" as const },
    { label: "Booking Requests", value: summary.byType["booking_request_click"] ?? 0, icon: MousePointerClick, accent: "gold" as const },
    { label: "Monthly Revenue", value: formatPrice(monthlyRevenue), icon: Wallet, accent: "forest" as const },
    { label: "Conversion Rate", value: `${conversion}%`, icon: TrendingUp, accent: "gold" as const },
  ];

  const recentLeads = leads.slice(0, 5);
  const upcoming = [...followups]
    .filter((f) => f.status === "pending")
    .sort((a, b) => (a.follow_up_date ?? "9999").localeCompare(b.follow_up_date ?? "9999"))
    .slice(0, 5);
  const topListings = Array.from(summary.perListing.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} accent={k.accent} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Views over time" action={<button onClick={() => onGo("insights")} className="text-xs font-semibold text-forest-600 hover:text-gold">Insights →</button>}>
          <LineChart points={summary.perDay.map((d) => d.views)} labels={summary.perDay.map((d) => d.date.slice(5))} />
        </Panel>
        <Panel title="Top performing listings">
          {topListings.length === 0 ? (
            <Empty text="No listing views yet" />
          ) : (
            <BarRows items={topListings.map((l) => ({ label: `${l.serviceType ?? "Listing"} · ${l.listingId.slice(0, 6)}`, value: l.views }))} />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Recent leads" action={<button onClick={() => onGo("leads")} className="text-xs font-semibold text-forest-600 hover:text-gold">All leads →</button>}>
          {recentLeads.length === 0 ? (
            <Empty text="No leads yet" />
          ) : (
            <div className="divide-y divide-border">
              {recentLeads.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-forest">{l.customer_name || "Lead"}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.interested_service || l.phone || "—"}</p>
                  </div>
                  <LeadStatusBadge status={l.lead_status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Upcoming follow-ups" action={<button onClick={() => onGo("followups")} className="text-xs font-semibold text-forest-600 hover:text-gold">All →</button>}>
          {upcoming.length === 0 ? (
            <Empty text="No follow-ups yet" />
          ) : (
            <div className="divide-y divide-border">
              {upcoming.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-forest">{f.customer_name || "Follow-up"}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.follow_up_date || "—"} {f.follow_up_time || ""}</p>
                  </div>
                  <PriorityBadge priority={f.priority} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-forest">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ================= Leads ================= */

function LeadsPage({ owner, leads, onChange }: { owner: string; leads: LeadRow[]; onChange: () => void }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [editing, setEditing] = React.useState<LeadRow | null>(null);
  const [adding, setAdding] = React.useState(false);

  const rows = leads.filter((l) => {
    if (status && l.lead_status !== status) return false;
    if (!q.trim()) return true;
    return `${l.customer_name ?? ""} ${l.phone ?? ""} ${l.email ?? ""} ${l.interested_service ?? ""} ${l.lead_source ?? ""}`
      .toLowerCase()
      .includes(q.toLowerCase());
  });

  const convert = async (l: LeadRow) => {
    await updateLead(l.id, { pipeline_stage: "new-request", lead_status: "confirmed" });
    onChange();
  };
  const markLost = async (l: LeadRow) => {
    await updateLead(l.id, { lead_status: "lost" });
    onChange();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads…" className="w-full bg-transparent text-sm focus:outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-forest px-4 py-2 text-sm font-semibold text-white shadow-soft hover:opacity-95">
          <Plus className="h-4 w-4" /> Add Lead
        </button>
      </div>

      {rows.length === 0 ? (
        <Empty text="No leads yet — add your first lead from WhatsApp, a call, walk-in or social." height={180} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-premium">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Customer</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Interested in</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Guests</th>
                <th className="p-3">Budget</th>
                <th className="p-3">Source</th>
                <th className="p-3">Status</th>
                <th className="p-3">Follow-up</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-border/60">
                  <td className="p-3">
                    <p className="font-semibold text-forest">{l.customer_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{l.email || l.city || ""}</p>
                  </td>
                  <td className="p-3 text-muted-foreground">{l.phone || "—"}</td>
                  <td className="p-3 text-muted-foreground">{l.interested_service || "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {l.check_in_date || l.travel_date || "—"}
                    {l.check_out_date ? ` → ${l.check_out_date}` : ""}
                  </td>
                  <td className="p-3 text-muted-foreground">{l.guests ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{l.budget ? formatPrice(Number(l.budget)) : "—"}</td>
                  <td className="p-3 capitalize text-muted-foreground">{l.lead_source || "—"}</td>
                  <td className="p-3"><LeadStatusBadge status={l.lead_status} /></td>
                  <td className="p-3 text-xs text-muted-foreground">{l.follow_up_datetime ? new Date(l.follow_up_datetime).toLocaleString() : "—"}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {l.phone && <a href={`tel:${l.phone}`} title="Call" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Phone className="h-3.5 w-3.5" /></a>}
                      {waLink(l.phone) && <a href={waLink(l.phone)} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="rounded-md border border-green-200 bg-green-50 p-1.5 text-green-700"><MessageCircle className="h-3.5 w-3.5" /></a>}
                      <button title="Edit" onClick={() => setEditing(l)} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      {l.lead_status !== "confirmed" && <button title="Convert to booking" onClick={() => convert(l)} className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                      {l.lead_status !== "lost" && <button title="Mark lost" onClick={() => markLost(l)} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><X className="h-3.5 w-3.5" /></button>}
                      <button title="Delete" onClick={() => { if (window.confirm("Delete this lead?")) { deleteLead(l.id).then(onChange); } }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(adding || editing) && (
        <LeadModal
          owner={owner}
          lead={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); onChange(); }}
        />
      )}
    </div>
  );
}

function LeadModal({ owner, lead, onClose, onSaved }: { owner: string; lead: LeadRow | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = React.useState({
    customer_name: lead?.customer_name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    city: lead?.city ?? "",
    country: lead?.country ?? "",
    interested_service: lead?.interested_service ?? "",
    check_in_date: lead?.check_in_date ?? "",
    check_out_date: lead?.check_out_date ?? "",
    travel_date: lead?.travel_date ?? "",
    guests: lead?.guests != null ? String(lead.guests) : "",
    budget: lead?.budget != null ? String(lead.budget) : "",
    lead_source: lead?.lead_source ?? "whatsapp",
    lead_status: lead?.lead_status ?? "new",
    follow_up_datetime: lead?.follow_up_datetime ? lead.follow_up_datetime.slice(0, 16) : "",
    notes: lead?.notes ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setError("");
    if (!f.customer_name.trim() && !f.phone.trim()) {
      setError("Enter at least a name or phone number.");
      return;
    }
    setSaving(true);
    const payload = {
      owner_email: owner,
      customer_name: f.customer_name.trim() || null,
      phone: f.phone.trim() || null,
      email: f.email.trim() || null,
      city: f.city.trim() || null,
      country: f.country.trim() || null,
      interested_service: f.interested_service.trim() || null,
      check_in_date: f.check_in_date || null,
      check_out_date: f.check_out_date || null,
      travel_date: f.travel_date || null,
      guests: f.guests ? Number(f.guests) : null,
      budget: f.budget ? Number(f.budget) : null,
      lead_source: f.lead_source,
      lead_status: f.lead_status,
      follow_up_datetime: f.follow_up_datetime ? new Date(f.follow_up_datetime).toISOString() : null,
      notes: f.notes.trim() || null,
    };
    const { error: err } = lead ? await updateLead(lead.id, payload) : await createLead(payload);
    setSaving(false);
    if (err) { setError("Could not save. Please try again."); return; }
    onSaved();
  };

  return (
    <Modal title={lead ? "Edit lead" : "Add new lead"} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Lbl label="Customer name"><input className="auth-input" value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></Lbl>
        <Lbl label="Phone"><input className="auth-input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Lbl>
        <Lbl label="Email"><input className="auth-input" value={f.email} onChange={(e) => set("email", e.target.value)} /></Lbl>
        <Lbl label="City / Country"><input className="auth-input" value={f.city} onChange={(e) => set("city", e.target.value)} /></Lbl>
        <Lbl label="Interested listing / service"><input className="auth-input" value={f.interested_service} onChange={(e) => set("interested_service", e.target.value)} /></Lbl>
        <Lbl label="Guests"><input type="number" min={0} className="auth-input" value={f.guests} onChange={(e) => set("guests", e.target.value)} /></Lbl>
        <Lbl label="Check-in / Travel date"><input type="date" className="auth-input" value={f.check_in_date || f.travel_date} onChange={(e) => { set("check_in_date", e.target.value); set("travel_date", e.target.value); }} /></Lbl>
        <Lbl label="Check-out date"><input type="date" className="auth-input" value={f.check_out_date} onChange={(e) => set("check_out_date", e.target.value)} /></Lbl>
        <Lbl label="Budget (PKR)"><input type="number" min={0} className="auth-input" value={f.budget} onChange={(e) => set("budget", e.target.value)} /></Lbl>
        <Lbl label="Lead source">
          <select className="auth-input capitalize" value={f.lead_source} onChange={(e) => set("lead_source", e.target.value)}>
            {LEAD_SOURCES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </Lbl>
        <Lbl label="Lead status">
          <select className="auth-input capitalize" value={f.lead_status} onChange={(e) => set("lead_status", e.target.value)}>
            {LEAD_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </Lbl>
        <Lbl label="Follow-up date & time"><input type="datetime-local" className="auth-input" value={f.follow_up_datetime} onChange={(e) => set("follow_up_datetime", e.target.value)} /></Lbl>
      </div>
      <Lbl label="Notes" className="mt-3"><textarea rows={3} className="auth-input resize-none" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Lbl>
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
      <ModalFooter onClose={onClose} onSave={save} saving={saving} label={lead ? "Save changes" : "Add lead"} />
    </Modal>
  );
}

/* ================= Customers ================= */

interface Customer {
  key: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  leads: LeadRow[];
  last: string;
}

function distinctCustomers(leads: LeadRow[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const l of leads) {
    const key = (l.email || l.phone || l.customer_name || l.id).toLowerCase();
    const cur =
      map.get(key) ??
      {
        key,
        name: l.customer_name || "Customer",
        phone: l.phone || "",
        email: l.email || "",
        city: l.city || "",
        country: l.country || "",
        leads: [],
        last: l.created_at,
      };
    cur.leads.push(l);
    if (l.created_at > cur.last) cur.last = l.created_at;
    if (!cur.name && l.customer_name) cur.name = l.customer_name;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.last.localeCompare(a.last));
}

function CustomersPage({ owner, leads, notes, onChange }: { owner: string; leads: LeadRow[]; notes: NoteRow[]; onChange: () => void }) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<Customer | null>(null);
  const customers = React.useMemo(() => distinctCustomers(leads), [leads]);
  const rows = customers.filter((c) => !q.trim() || `${c.name} ${c.phone} ${c.email} ${c.city}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers…" className="w-full bg-transparent text-sm focus:outline-none" />
      </div>
      <p className="text-xs text-muted-foreground">Customers appear here once they inquire, message or send you a booking request. Views &amp; saves stay anonymous.</p>
      {rows.length === 0 ? (
        <Empty text="No customers yet" height={160} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <button key={c.key} onClick={() => setOpen(c)} className="rounded-2xl border border-border bg-card p-4 text-left shadow-premium transition-shadow hover:shadow-card">
              <p className="font-semibold text-forest">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.phone || c.email || "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.city}{c.country ? `, ${c.country}` : ""}</p>
              <p className="mt-2 text-xs font-semibold text-forest-600">{c.leads.length} interaction{c.leads.length === 1 ? "" : "s"}</p>
            </button>
          ))}
        </div>
      )}
      {open && (
        <CustomerModal
          owner={owner}
          customer={open}
          notes={notes.filter((n) => n.entity_type === "customer" && n.entity_id === open.key)}
          onClose={() => setOpen(null)}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function CustomerModal({ owner, customer, notes, onClose, onChange }: { owner: string; customer: Customer; notes: NoteRow[]; onClose: () => void; onChange: () => void }) {
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await addNote({ owner_email: owner, entity_type: "customer", entity_id: customer.key, entity_label: customer.name, note: note.trim() });
    setNote("");
    setSaving(false);
    onChange();
  };
  return (
    <Modal title={customer.name} onClose={onClose}>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <KV k="Phone" v={customer.phone || "—"} />
        <KV k="Email" v={customer.email || "—"} />
        <KV k="City / Country" v={[customer.city, customer.country].filter(Boolean).join(", ") || "—"} />
        <KV k="Interactions" v={String(customer.leads.length)} />
      </div>
      <div className="mt-4">
        <p className="text-sm font-bold text-forest">History with you</p>
        <div className="mt-2 space-y-2">
          {customer.leads.map((l) => (
            <div key={l.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-forest">{l.interested_service || "Inquiry"}</span>
                <LeadStatusBadge status={l.lead_status} />
              </div>
              <span className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}{l.budget ? ` · ${formatPrice(Number(l.budget))}` : ""}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm font-bold text-forest">Private notes</p>
        {notes.map((n) => (
          <div key={n.id} className="mt-2 flex items-start justify-between gap-2 rounded-lg bg-gold/10 px-3 py-2 text-sm">
            <span className="text-forest/85">{n.note}</span>
            <button onClick={() => deleteNote(n.id).then(onChange)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a private note…" className="auth-input flex-1" />
          <button onClick={save} disabled={saving} className="rounded-lg bg-gradient-forest px-4 text-sm font-semibold text-white disabled:opacity-60">Add</button>
        </div>
      </div>
    </Modal>
  );
}

/* ================= Pipeline (Kanban) ================= */

function PipelinePage({ leads, onChange }: { leads: LeadRow[]; onChange: () => void }) {
  const inPipeline = leads.filter((l) => l.pipeline_stage);
  const move = async (l: LeadRow, stage: string) => {
    await updateLead(l.id, { pipeline_stage: stage });
    onChange();
  };
  if (inPipeline.length === 0) {
    return <Empty text="No bookings in the pipeline yet. Convert a lead to a booking to start tracking it here." height={180} />;
  }
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {PIPELINE_STAGES.map((stage) => {
        const cards = inPipeline.filter((l) => l.pipeline_stage === stage);
        return (
          <div key={stage} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-sm font-bold text-forest">{pipelineLabel(stage)}</span>
              <span className="rounded-full bg-white px-2 text-xs font-semibold text-muted-foreground">{cards.length}</span>
            </div>
            <div className="space-y-2">
              {cards.map((l) => (
                <div key={l.id} className="rounded-xl border border-border bg-card p-3 shadow-premium">
                  <p className="font-semibold text-forest">{l.customer_name || "Customer"}</p>
                  <p className="text-xs text-muted-foreground">{l.interested_service || "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(l.check_in_date || l.travel_date) ?? ""} · {l.guests ?? 1} guest{(l.guests ?? 1) > 1 ? "s" : ""}
                  </p>
                  {(l.amount || l.budget) && <p className="mt-0.5 text-sm font-bold text-forest">{formatPrice(Number(l.amount || l.budget))}</p>}
                  <div className="mt-2 flex items-center gap-1">
                    {l.phone && <a href={`tel:${l.phone}`} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Phone className="h-3.5 w-3.5" /></a>}
                    {waLink(l.phone) && <a href={waLink(l.phone)} target="_blank" rel="noopener noreferrer" className="rounded-md border border-green-200 bg-green-50 p-1.5 text-green-700"><MessageCircle className="h-3.5 w-3.5" /></a>}
                    <select value={l.pipeline_stage ?? ""} onChange={(e) => move(l, e.target.value)} className="ml-auto rounded-md border border-border bg-card px-1.5 py-1 text-xs">
                      {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{pipelineLabel(s)}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================= Follow-ups ================= */

function FollowupsPage({ owner, followups, onChange }: { owner: string; followups: FollowupRow[]; onChange: () => void }) {
  const [adding, setAdding] = React.useState(false);
  const set = async (f: FollowupRow, status: string) => { await updateFollowup(f.id, { status }); onChange(); };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-forest px-4 py-2 text-sm font-semibold text-white shadow-soft hover:opacity-95">
          <Plus className="h-4 w-4" /> Add Follow-up
        </button>
      </div>
      {followups.length === 0 ? (
        <Empty text="No follow-ups yet" height={160} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-premium">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Customer</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Service</th>
                <th className="p-3">Date</th>
                <th className="p-3">Time</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {followups.map((f) => (
                <tr key={f.id} className="border-b border-border/60">
                  <td className="p-3 font-semibold text-forest">{f.customer_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{f.phone || "—"}</td>
                  <td className="p-3 text-muted-foreground">{f.related_service || "—"}</td>
                  <td className="p-3 text-muted-foreground">{f.follow_up_date || "—"}</td>
                  <td className="p-3 text-muted-foreground">{f.follow_up_time || "—"}</td>
                  <td className="p-3"><PriorityBadge priority={f.priority} /></td>
                  <td className="p-3"><FollowupStatusBadge status={f.status} /></td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {f.phone && <a href={`tel:${f.phone}`} title="Call" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><Phone className="h-3.5 w-3.5" /></a>}
                      {waLink(f.phone) && <a href={waLink(f.phone)} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="rounded-md border border-green-200 bg-green-50 p-1.5 text-green-700"><MessageCircle className="h-3.5 w-3.5" /></a>}
                      {f.status !== "completed" && <button title="Mark completed" onClick={() => set(f, "completed")} className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                      {f.status !== "rescheduled" && <button title="Reschedule" onClick={() => set(f, "rescheduled")} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><CalendarClock className="h-3.5 w-3.5" /></button>}
                      <button title="Delete" onClick={() => { if (window.confirm("Delete this follow-up?")) deleteFollowup(f.id).then(onChange); }} className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && <FollowupModal owner={owner} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChange(); }} />}
    </div>
  );
}

function FollowupModal({ owner, onClose, onSaved }: { owner: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = React.useState({
    customer_name: "",
    phone: "",
    related_service: "",
    follow_up_date: "",
    follow_up_time: "",
    priority: "medium",
    note: "",
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    await createFollowup({
      owner_email: owner,
      customer_name: f.customer_name.trim() || null,
      phone: f.phone.trim() || null,
      related_service: f.related_service.trim() || null,
      follow_up_date: f.follow_up_date || null,
      follow_up_time: f.follow_up_time || null,
      priority: f.priority,
      note: f.note.trim() || null,
      status: "pending",
    });
    setSaving(false);
    onSaved();
  };
  return (
    <Modal title="Add follow-up" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Lbl label="Customer / lead name"><input className="auth-input" value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></Lbl>
        <Lbl label="Phone"><input className="auth-input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Lbl>
        <Lbl label="Related listing / service"><input className="auth-input" value={f.related_service} onChange={(e) => set("related_service", e.target.value)} /></Lbl>
        <Lbl label="Priority">
          <select className="auth-input capitalize" value={f.priority} onChange={(e) => set("priority", e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
          </select>
        </Lbl>
        <Lbl label="Follow-up date"><input type="date" className="auth-input" value={f.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} /></Lbl>
        <Lbl label="Follow-up time"><input type="time" className="auth-input" value={f.follow_up_time} onChange={(e) => set("follow_up_time", e.target.value)} /></Lbl>
      </div>
      <Lbl label="Note" className="mt-3"><textarea rows={3} className="auth-input resize-none" value={f.note} onChange={(e) => set("note", e.target.value)} /></Lbl>
      <ModalFooter onClose={onClose} onSave={save} saving={saving} label="Add follow-up" />
    </Modal>
  );
}

/* ================= Insights ================= */

function InsightsPage({ summary }: { summary: ReturnType<typeof summarize> }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const listings = Array.from(summary.perListing.values()).sort((a, b) => b.views - a.views);
  const cards = [
    { label: "Total Listings", value: listings.length },
    { label: "Total Views", value: summary.views },
    { label: "Unique Visitors", value: summary.uniqueVisitors },
    { label: "Wishlist Saves", value: summary.byType["wishlist_save"] ?? 0 },
    { label: "WhatsApp Clicks", value: summary.byType["whatsapp_click"] ?? 0 },
    { label: "Booking Requests", value: summary.byType["booking_request_click"] ?? 0 },
    { label: "Avg Conversion", value: `${pct(summary.byType["booking_request_click"] ?? 0, summary.views)}%` },
  ];
  const openStat = open ? summary.perListing.get(open) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map((c) => <KpiCard key={c.label} label={c.label} value={c.value} />)}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Views over time"><LineChart points={summary.perDay.map((d) => d.views)} labels={summary.perDay.map((d) => d.date.slice(5))} /></Panel>
        <Panel title="Device analytics">
          <Donut segments={[
            { label: "mobile", value: summary.devices["mobile"] ?? 0, color: "#0d7a5f" },
            { label: "desktop", value: summary.devices["desktop"] ?? 0, color: "#d4a017" },
            { label: "tablet", value: summary.devices["tablet"] ?? 0, color: "#60a5fa" },
          ]} />
        </Panel>
      </div>

      {listings.length === 0 ? (
        <Empty text="No listing views yet" height={160} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-premium">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Listing</th>
                <th className="p-3">Category</th>
                <th className="p-3">Views</th>
                <th className="p-3">Saves</th>
                <th className="p-3">WhatsApp</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Msg</th>
                <th className="p-3">Bookings</th>
                <th className="p-3">Conv.</th>
                <th className="p-3 text-right">Insights</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.listingId} className="border-b border-border/60">
                  <td className="p-3 font-semibold text-forest">{l.listingId.slice(0, 8)}…</td>
                  <td className="p-3 capitalize text-muted-foreground">{l.serviceType || "—"}</td>
                  <td className="p-3 text-muted-foreground">{l.views}</td>
                  <td className="p-3 text-muted-foreground">{l.saves}</td>
                  <td className="p-3 text-muted-foreground">{l.whatsapp}</td>
                  <td className="p-3 text-muted-foreground">{l.phone}</td>
                  <td className="p-3 text-muted-foreground">{l.message}</td>
                  <td className="p-3 text-muted-foreground">{l.booking}</td>
                  <td className="p-3 text-muted-foreground">{pct(l.booking, l.views)}%</td>
                  <td className="p-3 text-right">
                    <button onClick={() => setOpen(l.listingId)} className="rounded-md border border-border p-1.5 text-forest hover:bg-muted"><BarChart3 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openStat && (
        <Modal title="Listing insights" onClose={() => setOpen(null)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Mini label="Total Views" value={openStat.views} />
            <Mini label="Wishlist Saves" value={openStat.saves} />
            <Mini label="WhatsApp Clicks" value={openStat.whatsapp} />
            <Mini label="Phone Clicks" value={openStat.phone} />
            <Mini label="Message Clicks" value={openStat.message} />
            <Mini label="Booking Requests" value={openStat.booking} />
            <Mini label="Views → Save" value={`${pct(openStat.saves, openStat.views)}%`} />
            <Mini label="Views → Booking" value={`${pct(openStat.booking, openStat.views)}%`} />
            <Mini label="Save → Booking" value={`${pct(openStat.booking, openStat.saves)}%`} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
      <p className="font-display text-xl font-bold text-forest">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ================= Customer Actions ================= */

function ActionsPage({ events, summary }: { events: AnalyticsEventRow[]; summary: ReturnType<typeof summarize> }) {
  const [type, setType] = React.useState("");
  const rows = events.filter((e) => !type || e.event_type === type).slice(0, 300);
  const breakdown = Object.entries(summary.byType)
    .map(([k, v]) => ({ label: eventLabel(k), value: v }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Privacy: customer actions are anonymous. You see what happened and when — never a viewer&apos;s name, phone or email unless they send you an inquiry.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Customer action breakdown"><BarRows items={breakdown} /></Panel>
        <Panel title="Devices">
          <Donut segments={[
            { label: "mobile", value: summary.devices["mobile"] ?? 0, color: "#0d7a5f" },
            { label: "desktop", value: summary.devices["desktop"] ?? 0, color: "#d4a017" },
            { label: "tablet", value: summary.devices["tablet"] ?? 0, color: "#60a5fa" },
          ]} />
        </Panel>
      </div>

      <div className="flex items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <option value="">All actions</option>
          {Object.keys(summary.byType).map((t) => <option key={t} value={t}>{eventLabel(t)}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty text="No customer actions yet" height={160} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-premium">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Action</th>
                <th className="p-3">Listing</th>
                <th className="p-3">Category</th>
                <th className="p-3">Device</th>
                <th className="p-3">Location</th>
                <th className="p-3">Referrer</th>
                <th className="p-3">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border/60">
                  <td className="p-3 font-medium text-forest">{eventLabel(e.event_type)}</td>
                  <td className="p-3 text-muted-foreground">{e.listing_id ? e.listing_id.slice(0, 8) + "…" : "—"}</td>
                  <td className="p-3 capitalize text-muted-foreground">{e.service_type || "—"}</td>
                  <td className="p-3 capitalize text-muted-foreground">{e.device_type || "—"}</td>
                  <td className="p-3 text-muted-foreground">{[e.city, e.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="p-3 max-w-[160px] truncate text-muted-foreground">{e.referrer || "Direct"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= Notes ================= */

function NotesPage({ owner, notes, onChange }: { owner: string; notes: NoteRow[]; onChange: () => void }) {
  const [type, setType] = React.useState("lead");
  const [label, setLabel] = React.useState("");
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const add = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await addNote({ owner_email: owner, entity_type: type, entity_label: label.trim() || null, note: text.trim() });
    setText("");
    setLabel("");
    setSaving(false);
    onChange();
  };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-premium">
        <p className="flex items-center gap-1.5 text-sm font-bold text-forest"><StickyNote className="h-4 w-4 text-gold" /> Add a private note</p>
        <p className="text-xs text-muted-foreground">Only you and the admin can see notes.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr]">
          <select value={type} onChange={(e) => setType(e.target.value)} className="auth-input capitalize">
            {["lead", "customer", "booking", "listing"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Related to (name / listing)…" className="auth-input" />
        </div>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your note…" className="auth-input mt-2 resize-none" />
        <button onClick={add} disabled={saving} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add note
        </button>
      </div>
      {notes.length === 0 ? (
        <Empty text="No notes yet" height={140} />
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-premium">
              <div>
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold-700">{n.entity_type}</span>
                {n.entity_label && <span className="ml-2 text-xs font-semibold text-forest">{n.entity_label}</span>}
                <p className="mt-1 text-sm text-forest/85">{n.note}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => deleteNote(n.id).then(onChange)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= Shared bits ================= */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-6 w-full max-w-2xl rounded-3xl bg-card p-6 shadow-premium-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-forest">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-forest"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ onClose, onSave, saving, label }: { onClose: () => void; onSave: () => void; saving: boolean; label: string }) {
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
      <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-forest">Cancel</button>
      <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gradient-forest px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {label}
      </button>
    </div>
  );
}

function Lbl({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium text-forest">{v}</span>
    </div>
  );
}

function LeadStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-blue-50 text-blue-600",
    contacted: "bg-forest-50 text-forest-600",
    interested: "bg-gold/20 text-gold-700",
    "follow-up": "bg-gold/20 text-gold-700",
    confirmed: "bg-green-50 text-green-600",
    lost: "bg-red-50 text-red-600",
  };
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", map[status] ?? "bg-muted")}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    low: "bg-muted text-forest",
    medium: "bg-blue-50 text-blue-600",
    high: "bg-gold/20 text-gold-700",
    urgent: "bg-red-50 text-red-600",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", map[priority] ?? "bg-muted")}>
      {priority === "urgent" && <Flame className="h-3 w-3" />} {priority}
    </span>
  );
}

function FollowupStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-gold/20 text-gold-700",
    completed: "bg-green-50 text-green-600",
    rescheduled: "bg-blue-50 text-blue-600",
  };
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", map[status] ?? "bg-muted")}>{status}</span>;
}
