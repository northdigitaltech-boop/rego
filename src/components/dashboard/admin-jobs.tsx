"use client";

import * as React from "react";
import Link from "next/link";
import {
  Loader2,
  Search,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Pencil,
  Sparkles,
  Flame,
  Pause,
  Play,
  Users,
  FileText,
  Mail,
  Phone,
  ChevronDown,
} from "lucide-react";

import {
  getAllJobs,
  setJobStatus,
  setJobFlag,
  deleteJob,
  getAllApplicants,
  statusMeta,
  salaryLabel,
  jobLocation,
  JOB_STATUSES,
  APPLICANT_STATUSES,
  type JobRow,
  type JobApplicantRow,
  type JobStatus,
} from "@/lib/jobs";
import { sendEmail } from "@/lib/email";
import { cn } from "@/lib/utils";

type View = "jobs" | "applications";

export function AdminJobs() {
  const [view, setView] = React.useState<View>("jobs");
  const [jobs, setJobs] = React.useState<JobRow[] | null>(null);
  const [apps, setApps] = React.useState<JobApplicantRow[]>([]);

  const refresh = React.useCallback(async () => {
    const [j, a] = await Promise.all([getAllJobs(), getAllApplicants()]);
    setJobs(j);
    setApps(a);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const pending = (jobs ?? []).filter((j) => j.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">Jobs Portal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review vacancies posted by providers and manage applications.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {([
            ["jobs", `Jobs${pending ? ` (${pending})` : ""}`],
            ["applications", `Applications${apps.length ? ` (${apps.length})` : ""}`],
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

      {jobs === null ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : view === "jobs" ? (
        <JobsReview jobs={jobs} onChange={refresh} />
      ) : (
        <AllApplications rows={apps} />
      )}
    </div>
  );
}

/* ---------------- jobs review ---------------- */

function JobsReview({ jobs, onChange }: { jobs: JobRow[]; onChange: () => void }) {
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | JobStatus>("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [noteFor, setNoteFor] = React.useState<JobRow | null>(null);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    for (const j of jobs) c[j.status] = (c[j.status] ?? 0) + 1;
    return c;
  }, [jobs]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await onChange();
    setBusyId(null);
  };

  const decide = async (j: JobRow, status: JobStatus, note?: string) => {
    await act(j.id, async () => {
      await setJobStatus(j.id, status, note);
      const label =
        status === "published" ? "approved and published"
        : status === "rejected" ? "rejected"
        : status === "changes_required" ? "sent back for changes"
        : status;
      sendEmail(
        j.contact_email || j.owner_email,
        `Your Rego job posting was ${label}`,
        `<p>Your vacancy <strong>${j.title}</strong> has been <strong>${label}</strong>.</p>
         ${note ? `<p><strong>Note from the Rego team:</strong> ${note}</p>` : ""}
         ${status === "published" ? `<p>It's now live on the Rego Jobs portal.</p>` : `<p>You can update it from your dashboard under My Jobs.</p>`}`
      ).catch(() => {});
    });
  };

  const list = jobs.filter((j) => {
    if (filter !== "all" && j.status !== filter) return false;
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return `${j.title} ${j.business_name} ${j.city ?? ""} ${j.category ?? ""}`.toLowerCase().includes(t);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([["all", "All"], ...JOB_STATUSES.map((s) => [s.value, s.label])] as [string, string][]).map(
          ([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value as "all" | JobStatus)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === value ? "bg-gradient-forest text-white" : "border border-border bg-card text-forest hover:bg-muted"
              )}
            >
              {label} {counts[value] ? `(${counts[value]})` : ""}
            </button>
          )
        )}
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs or businesses…" className="w-full bg-transparent text-sm focus:outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{list.length}</span>
      </label>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          No jobs here.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((j) => {
            const meta = statusMeta(j.status);
            const rowBusy = busyId === j.id;
            return (
              <div key={j.id} className="rounded-2xl border border-border bg-card p-4 shadow-premium">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-bold text-forest">{j.title}</h3>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", meta.tone)}>{meta.label}</span>
                      {j.featured && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold-700">Featured</span>}
                      {j.urgent && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Urgent</span>}
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{j.business_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {j.category ?? "—"} · {jobLocation(j)} · {j.employment_type} · {salaryLabel(j)}
                      {j.deadline && ` · closes ${new Date(j.deadline).toLocaleDateString()}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {j.slug && (
                      <Link href={`/jobs/${j.slug}`} target="_blank" title="Preview" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    <button title={j.featured ? "Unfeature" : "Feature"} disabled={rowBusy}
                      onClick={() => act(j.id, () => setJobFlag(j.id, "featured", !j.featured))}
                      className={cn("rounded-md border p-1.5", j.featured ? "border-gold/40 bg-gold/10 text-gold-700" : "border-border text-forest hover:bg-muted")}>
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                    <button title={j.urgent ? "Not urgent" : "Mark urgent"} disabled={rowBusy}
                      onClick={() => act(j.id, () => setJobFlag(j.id, "urgent", !j.urgent))}
                      className={cn("rounded-md border p-1.5", j.urgent ? "border-red-200 bg-red-50 text-red-600" : "border-border text-forest hover:bg-muted")}>
                      <Flame className="h-3.5 w-3.5" />
                    </button>

                    {j.status !== "published" && (
                      <button disabled={rowBusy} onClick={() => decide(j, "published")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-forest-50 px-2.5 py-1.5 text-xs font-bold text-forest-700 hover:bg-forest-100">
                        {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve
                      </button>
                    )}
                    {j.status === "published" && (
                      <button disabled={rowBusy} onClick={() => act(j.id, () => setJobStatus(j.id, "paused"))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-forest hover:bg-muted">
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </button>
                    )}
                    {j.status === "paused" && (
                      <button disabled={rowBusy} onClick={() => act(j.id, () => setJobStatus(j.id, "published"))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-forest-50 px-2.5 py-1.5 text-xs font-bold text-forest-700 hover:bg-forest-100">
                        <Play className="h-3.5 w-3.5" /> Resume
                      </button>
                    )}
                    <button disabled={rowBusy} onClick={() => setNoteFor(j)} title="Request changes"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100">
                      <Pencil className="h-3.5 w-3.5" /> Changes
                    </button>
                    <button disabled={rowBusy} onClick={() => decide(j, "rejected")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                    <button disabled={rowBusy}
                      onClick={() => { if (window.confirm(`Delete "${j.title}"?`)) act(j.id, () => deleteJob(j.id)); }}
                      title="Delete" className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {j.admin_note && (
                  <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
                    <strong>Note sent:</strong> {j.admin_note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {noteFor && (
        <ChangesModal
          job={noteFor}
          onClose={() => setNoteFor(null)}
          onSend={async (note) => {
            await decide(noteFor, "changes_required", note);
            setNoteFor(null);
          }}
        />
      )}
    </div>
  );
}

function ChangesModal({
  job,
  onClose,
  onSend,
}: {
  job: JobRow;
  onClose: () => void;
  onSend: (note: string) => Promise<void>;
}) {
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-premium-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-base font-bold text-forest">Request changes</h3>
        <p className="mt-1 text-xs text-muted-foreground">{job.title} · {job.business_name}</p>
        <textarea
          rows={4}
          className="auth-input mt-3 resize-none"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Tell the employer what needs fixing before this can go live…"
        />
        <div className="mt-3 flex gap-2">
          <button
            disabled={!note.trim() || busy}
            onClick={async () => { setBusy(true); await onSend(note.trim()); setBusy(false); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-2.5 text-sm font-bold text-forest-900 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send to employer
          </button>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-forest hover:bg-muted">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- all applications ---------------- */

function AllApplications({ rows }: { rows: JobApplicantRow[] }) {
  const [q, setQ] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const list = rows.filter((a) => {
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return (
      a.full_name.toLowerCase().includes(t) ||
      a.email.toLowerCase().includes(t) ||
      (a.job_title ?? "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search applicants…" className="w-full bg-transparent text-sm focus:outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{list.length}</span>
      </label>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          <Users className="mx-auto h-8 w-8" />
          <p className="mt-2">No applications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const open = openId === a.id;
            const meta = APPLICANT_STATUSES.find((s) => s.value === a.status);
            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card shadow-premium">
                <button onClick={() => setOpenId(open ? null : a.id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-forest">{a.full_name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", meta?.tone)}>{meta?.label ?? a.status}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.job_title} · {a.owner_email} · {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="border-t border-border p-4">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <a href={`mailto:${a.email}`} className="inline-flex items-center gap-2 text-forest hover:text-gold">
                        <Mail className="h-4 w-4 text-forest-600" /> {a.email}
                      </a>
                      {a.phone && (
                        <a href={`tel:${a.phone}`} className="inline-flex items-center gap-2 text-forest hover:text-gold">
                          <Phone className="h-4 w-4 text-forest-600" /> {a.phone}
                        </a>
                      )}
                      {a.cv_url && (
                        <a href={a.cv_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-forest-600 hover:text-gold">
                          <FileText className="h-4 w-4" /> View CV
                        </a>
                      )}
                    </div>
                    {a.intro && <p className="mt-3 whitespace-pre-line text-sm text-forest-800">{a.intro}</p>}
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
