"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  Trash2,
  FileText,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  Download,
} from "lucide-react";

import {
  getApplications,
  setApplicationStatus,
  setApplicationNote,
  deleteApplication,
  APPLICATION_STATUSES,
  SCREENING_QUESTIONS,
  type JobApplicationRow,
  type ApplicationStatus,
} from "@/lib/careers";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  new: "bg-amber-50 text-amber-700",
  shortlisted: "bg-forest-50 text-forest-700",
  interview: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-600",
  hired: "bg-green-50 text-green-700",
};

export function AdminApplications() {
  const [rows, setRows] = React.useState<JobApplicationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | ApplicationStatus>("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setRows(await getApplications());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await refresh();
    setBusyId(null);
  };

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return (
      r.full_name.toLowerCase().includes(t) ||
      r.email.toLowerCase().includes(t) ||
      r.job_title.toLowerCase().includes(t) ||
      (r.city ?? "").toLowerCase().includes(t) ||
      (r.phone ?? "").toLowerCase().includes(t) ||
      (r.skills ?? []).some((s) => s.toLowerCase().includes(t))
    );
  });

  const exportCsv = () => {
    const head = [
      "Name", "Email", "Phone", "City", "Role", "Status", "Applied",
      "Skills", "Paid ads", "Tourism exp", "Vehicle", "Can travel", "Portfolio", "CV",
    ];
    const lines = filtered.map((r) =>
      [
        r.full_name,
        r.email,
        r.phone ?? "",
        r.city ?? "",
        r.job_title,
        r.status,
        new Date(r.created_at).toLocaleDateString(),
        (r.skills ?? []).join("; "),
        r.ran_paid_ads ?? "",
        r.tourism_exp ?? "",
        r.has_vehicle ?? "",
        r.can_travel ?? "",
        r.portfolio_url ?? "",
        r.cv_url ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rego-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">Job Applications</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone who applied through the careers page.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-forest hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {([["all", "All"], ...APPLICATION_STATUSES.map((s) => [s.value, s.label])] as [string, string][]).map(
          ([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value as "all" | ApplicationStatus)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === value
                  ? "bg-gradient-forest text-white"
                  : "border border-border bg-card text-forest hover:bg-muted"
              )}
            >
              {label} {counts[value] ? `(${counts[value]})` : ""}
            </button>
          )
        )}
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, role, city…"
          className="w-full bg-transparent text-sm focus:outline-none"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{filtered.length}</span>
      </label>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          No applications yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const expanded = openId === r.id;
            const rowBusy = busyId === r.id;
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card shadow-premium">
                <button
                  onClick={() => setOpenId(expanded ? null : r.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-forest">{r.full_name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", STATUS_TONE[r.status] ?? "bg-muted text-muted-foreground")}>
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.job_title} · {r.city || "—"} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                </button>

                {expanded && (
                  <div className="border-t border-border p-4">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <a href={`mailto:${r.email}`} className="inline-flex items-center gap-2 text-forest hover:text-gold">
                        <Mail className="h-4 w-4 text-forest-600" /> {r.email}
                      </a>
                      {r.phone && (
                        <a href={`tel:${r.phone}`} className="inline-flex items-center gap-2 text-forest hover:text-gold">
                          <Phone className="h-4 w-4 text-forest-600" /> {r.phone}
                        </a>
                      )}
                      {r.city && (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 text-forest-600" /> {r.city}
                        </span>
                      )}
                      {r.cv_url && (
                        <a
                          href={r.cv_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 font-semibold text-forest-600 hover:text-gold"
                        >
                          <FileText className="h-4 w-4" /> View CV
                        </a>
                      )}
                    </div>

                    {/* Marketing skills */}
                    {(r.skills?.length ?? 0) > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skills</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {r.skills!.map((s) => (
                            <span key={s} className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[11px] font-semibold text-forest-700">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Screening answers */}
                    {SCREENING_QUESTIONS.some((q) => r[q.key]) && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Screening</p>
                        <div className="mt-1 grid gap-1 sm:grid-cols-2">
                          {SCREENING_QUESTIONS.filter((q) => r[q.key]).map((q) => {
                            const a = r[q.key] as string;
                            return (
                              <div key={q.key} className="flex items-start gap-2 text-xs">
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-2 py-0.5 font-bold",
                                    a === "Yes"
                                      ? "bg-green-50 text-green-700"
                                      : a === "No"
                                        ? "bg-red-50 text-red-600"
                                        : "bg-amber-50 text-amber-700"
                                  )}
                                >
                                  {a}
                                </span>
                                <span className="text-muted-foreground">{q.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {r.portfolio_url && (
                      <a
                        href={r.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-forest-600 hover:text-gold"
                      >
                        <FileText className="h-4 w-4" /> Portfolio
                      </a>
                    )}

                    {r.experience && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experience</p>
                        <p className="mt-0.5 whitespace-pre-line text-sm text-forest-800">{r.experience}</p>
                      </div>
                    )}
                    {r.cover_note && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why they applied</p>
                        <p className="mt-0.5 whitespace-pre-line text-sm text-forest-800">{r.cover_note}</p>
                      </div>
                    )}

                    <label className="mt-3 block">
                      <span className="mb-1 block text-xs font-semibold text-muted-foreground">Internal note</span>
                      <textarea
                        rows={2}
                        defaultValue={r.admin_note ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== (r.admin_note ?? "")) {
                            act(r.id, () => setApplicationNote(r.id, e.target.value));
                          }
                        }}
                        placeholder="Notes for your team (saved when you click away)…"
                        className="auth-input resize-none"
                      />
                    </label>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Status:</span>
                      {APPLICATION_STATUSES.map((s) => (
                        <button
                          key={s.value}
                          disabled={rowBusy}
                          onClick={() => act(r.id, () => setApplicationStatus(r.id, s.value))}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                            r.status === s.value
                              ? "bg-gradient-forest text-white"
                              : "border border-border text-forest hover:bg-muted"
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                      <button
                        disabled={rowBusy}
                        onClick={() => {
                          if (window.confirm(`Delete ${r.full_name}'s application?`)) {
                            act(r.id, () => deleteApplication(r.id));
                          }
                        }}
                        title="Delete"
                        className="ml-auto rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
