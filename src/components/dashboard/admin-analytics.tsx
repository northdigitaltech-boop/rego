"use client";

import * as React from "react";
import {
  Building2,
  Home,
  Briefcase,
  Map,
  UserRound,
  Camera,
  UtensilsCrossed,
  Bus,
  Plane,
  Wrench,
  CalendarDays,
  Mountain,
  Store,
  Tent,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Plus,
  Eye,
  CheckCircle2,
  XCircle,
  Ban,
  ShieldCheck,
  Trash2,
  Mail,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  MODULES,
  statsFromRows,
  bookingCount,
  rowsToCsv,
  type AdminRow,
  type ModuleConfig,
  type ModuleStats,
} from "@/lib/admin-analytics";

const ICONS: Record<string, LucideIcon> = {
  Building2,
  Home,
  Briefcase,
  Map,
  UserRound,
  Camera,
  UtensilsCrossed,
  Bus,
  Plane,
  Wrench,
  CalendarDays,
  Mountain,
  Store,
  Tent,
};

export function AdminAnalytics() {
  const [active, setActive] = React.useState<ModuleConfig | null>(null);

  if (active) {
    return <ModuleTable module={active} onBack={() => setActive(null)} />;
  }
  return <AnalyticsOverview onOpen={setActive} />;
}

/* ============================== Overview ============================== */

function AnalyticsOverview({ onOpen }: { onOpen: (m: ModuleConfig) => void }) {
  const [stats, setStats] = React.useState<Record<string, ModuleStats>>({});

  React.useEffect(() => {
    let alive = true;
    (async () => {
      for (const m of MODULES) {
        if (!m.live || !m.load) continue;
        try {
          const rows = await m.load();
          const base = statsFromRows(rows);
          const bookings = await bookingCount(m.bookingTable);
          if (alive) setStats((s) => ({ ...s, [m.id]: { ...base, bookings } }));
        } catch {
          /* ignore a failing module */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every service in one place. Click a module to manage its owners, listings and approvals.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => {
          const Icon = ICONS[m.icon] ?? Building2;
          const st = stats[m.id];
          return (
            <button
              key={m.id}
              type="button"
              disabled={!m.live}
              onClick={() => m.live && onOpen(m)}
              className={cn(
                "group flex flex-col rounded-3xl border bg-card p-5 text-left shadow-premium transition-all",
                m.live
                  ? "border-border/70 hover:-translate-y-1 hover:shadow-premium-lg"
                  : "cursor-not-allowed border-dashed border-border opacity-70"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-forest text-gold">
                  <Icon className="h-6 w-6" />
                </span>
                {!m.live && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                    Coming soon
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-display text-base font-bold text-forest">{m.name}</h3>

              {m.live ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <Mini label="Owners" value={st?.owners} />
                    <Mini label="Listings" value={st?.listings} />
                    <Mini label="Pending" value={st?.pending} accent={!!st?.pending} />
                    <Mini label="Bookings" value={st?.bookings} />
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest-600 group-hover:text-forest">
                    View details <ChevronRight className="h-4 w-4" />
                  </span>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Module not yet available.</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value?: number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/50 px-2.5 py-1.5">
      <p className={cn("font-display text-lg font-bold", accent ? "text-gold-700" : "text-forest")}>
        {value ?? "…"}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

/* ============================== Module table ============================== */

const STATUS_FILTERS = ["all", "pending", "approved", "rejected", "suspended"] as const;

function ModuleTable({ module, onBack }: { module: ModuleConfig; onBack: () => void }) {
  const [rows, setRows] = React.useState<AdminRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<(typeof STATUS_FILTERS)[number]>("all");
  const [city, setCity] = React.useState("all");
  const [verified, setVerified] = React.useState<"all" | "yes" | "no">("all");

  const reload = React.useCallback(async () => {
    if (!module.load) return;
    const r = await module.load();
    setRows(r);
    setLoading(false);
  }, [module]);

  React.useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const cities = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.city).filter(Boolean))).sort(),
    [rows]
  );

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (city !== "all" && r.city !== city) return false;
    if (verified === "yes" && !r.verified) return false;
    if (verified === "no" && r.verified) return false;
    if (q) {
      const t = q.toLowerCase();
      if (
        !r.business.toLowerCase().includes(t) &&
        !r.ownerEmail.toLowerCase().includes(t) &&
        !r.city.toLowerCase().includes(t) &&
        !r.category.toLowerCase().includes(t)
      )
        return false;
    }
    return true;
  });

  const st = statsFromRows(rows);

  const act = async (id: string, fn: () => unknown) => {
    setBusy(id);
    await fn();
    await reload();
    setBusy(null);
  };

  const exportCsv = () => {
    const blob = new Blob([rowsToCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${module.id}-listings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Icon = ICONS[module.icon] ?? Building2;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold">
          <ChevronLeft className="h-4 w-4" /> Analytics
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-forest text-gold">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold text-forest">{module.name}</h2>
          <p className="text-sm text-muted-foreground">Manage owners, listings and approvals.</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Owners" value={st.owners} />
        <Stat label="Listings" value={st.listings} />
        <Stat label="Pending" value={st.pending} accent={!!st.pending} />
        <Stat label="Approved" value={st.approved} />
        <Stat label="Suspended" value={st.suspended} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <a href={module.addHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-gradient-gold px-3.5 py-2 text-sm font-semibold text-forest-900 shadow-soft hover:-translate-y-0.5">
          <Plus className="h-4 w-4" /> Add New
        </a>
        <button onClick={() => setStatus("pending")} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-forest hover:bg-muted">View Pending</button>
        <button onClick={() => setStatus("approved")} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-forest hover:bg-muted">Approved</button>
        <button onClick={() => setStatus("suspended")} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-forest hover:bg-muted">Suspended</button>
        <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-forest hover:bg-muted">
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, owner email, city, category…"
            className="w-full bg-transparent text-sm text-forest focus:outline-none"
          />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-forest">
          {STATUS_FILTERS.map((sx) => (
            <option key={sx} value={sx}>{sx === "all" ? "All status" : sx}</option>
          ))}
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="max-w-[10rem] rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-forest">
          <option value="all">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={verified} onChange={(e) => setVerified(e.target.value as typeof verified)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-forest">
          <option value="all">All</option>
          <option value="yes">Verified</option>
          <option value="no">Unverified</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-premium">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-3 font-semibold">Business</th>
              <th className="px-3 py-3 font-semibold">Owner</th>
              <th className="px-3 py-3 font-semibold">City</th>
              <th className="px-3 py-3 font-semibold">Category</th>
              {module.metricLabel !== "—" && module.metricLabel !== "" && (
                <th className="px-3 py-3 font-semibold">{module.metricLabel}</th>
              )}
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Verified</th>
              <th className="px-3 py-3 font-semibold">Registered</th>
              <th className="px-3 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">No records match your filters.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-3 font-semibold text-forest">{r.business || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.ownerEmail || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.city || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.category || "—"}</td>
                  {module.metricLabel !== "—" && module.metricLabel !== "" && (
                    <td className="px-3 py-3 text-forest">{r.metric || "—"}</td>
                  )}
                  <td className="px-3 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-3 py-3">
                    {r.verified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-forest-600"><ShieldCheck className="h-3.5 w-3.5" /> Yes</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{(r.created_at || "").slice(0, 10)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="View" href={`/listings/${r.id}`}><Eye className="h-4 w-4" /></IconBtn>
                      {module.setStatus && (
                        <>
                          <IconBtn title="Approve" disabled={busy === r.id} onClick={() => act(r.id, () => module.setStatus!(r.id, "approved"))}><CheckCircle2 className="h-4 w-4 text-forest-600" /></IconBtn>
                          <IconBtn title="Reject" disabled={busy === r.id} onClick={() => act(r.id, () => module.setStatus!(r.id, "rejected"))}><XCircle className="h-4 w-4 text-red-600" /></IconBtn>
                          <IconBtn title="Suspend" disabled={busy === r.id} onClick={() => act(r.id, () => module.setStatus!(r.id, "suspended"))}><Ban className="h-4 w-4 text-amber-600" /></IconBtn>
                        </>
                      )}
                      {module.setVerified && (
                        <IconBtn title={r.verified ? "Unverify" : "Verify"} disabled={busy === r.id} onClick={() => act(r.id, () => module.setVerified!(r.id, !r.verified))}>
                          <ShieldCheck className={cn("h-4 w-4", r.verified ? "text-forest-600" : "text-muted-foreground")} />
                        </IconBtn>
                      )}
                      {r.ownerEmail && (
                        <IconBtn title="Send message" href={`mailto:${r.ownerEmail}`}><Mail className="h-4 w-4" /></IconBtn>
                      )}
                      {module.remove && (
                        <IconBtn
                          title="Delete"
                          disabled={busy === r.id}
                          onClick={() => {
                            if (confirm(`Delete "${r.business}"? This cannot be undone.`)) act(r.id, () => module.remove!(r.id));
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-premium">
      <p className={cn("font-display text-2xl font-bold", accent ? "text-gold-700" : "text-forest")}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-forest-50 text-forest-600",
    pending: "bg-gold/20 text-gold-700",
    rejected: "bg-red-50 text-red-600",
    suspended: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase", map[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  href,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const cls = "grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-forest transition-colors hover:bg-muted disabled:opacity-50";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} aria-label={title} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
