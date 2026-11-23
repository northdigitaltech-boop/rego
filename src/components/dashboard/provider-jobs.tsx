"use client";

import * as React from "react";
import Link from "next/link";
import {
  Briefcase,
  Loader2,
  Save,
  Search,
  Trash2,
  Pencil,
  ExternalLink,
  Users,
  FileText,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DistrictSelect } from "@/components/ui/location-select";
import {
  EMPLOYMENT_TYPES,
  WORKPLACE_TYPES,
  EXPERIENCE_LEVELS,
  SALARY_PERIODS,
  JOB_CATEGORIES,
  APPLICANT_STATUSES,
  statusMeta,
  salaryLabel,
  jobLocation,
  createJob,
  updateJob,
  deleteJob,
  resubmitJob,
  getMyJobs,
  getApplicantsForOwner,
  setApplicantStatus,
  setApplicantNote,
  getOwnerBusinesses,
  type JobRow,
  type JobApplicantRow,
  type OwnerBusiness,
  type ApplicantStatus,
} from "@/lib/jobs";
import { cn } from "@/lib/utils";

interface DashUser {
  name: string;
  email: string;
  businessCategory?: string;
}

/* ============================================================
 * 1) POST A JOB
 * ============================================================ */
export function ProviderPostJob({
  user,
  editing,
  onDone,
}: {
  user: DashUser;
  editing?: JobRow | null;
  onDone?: () => void;
}) {
  const [businesses, setBusinesses] = React.useState<OwnerBusiness[]>([]);
  const [bizIndex, setBizIndex] = React.useState(0);
  const [loadingBiz, setLoadingBiz] = React.useState(true);

  const [f, setF] = React.useState({
    title: editing?.title ?? "",
    category: editing?.category ?? "",
    description: editing?.description ?? "",
    responsibilities: editing?.responsibilities ?? "",
    skills: editing?.skills ?? "",
    experience_level: editing?.experience_level ?? "",
    employment_type: editing?.employment_type ?? "Full-time",
    workplace_type: editing?.workplace_type ?? "On-site",
    vacancies: String(editing?.vacancies ?? 1),
    salary_disclosed: editing?.salary_disclosed ?? true,
    salary_min: editing?.salary_min ? String(editing.salary_min) : "",
    salary_max: editing?.salary_max ? String(editing.salary_max) : "",
    salary_period: editing?.salary_period ?? "month",
    district: editing?.district ?? "",
    city: editing?.city ?? "",
    deadline: editing?.deadline ?? "",
    contact_name: editing?.contact_name ?? user.name,
    contact_phone: editing?.contact_phone ?? "",
    contact_email: editing?.contact_email ?? user.email,
    cv_required: editing?.cv_required ?? true,
    application_method: editing?.application_method ?? "rego",
    external_url: editing?.external_url ?? "",
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    getOwnerBusinesses(user.email).then((b) => {
      setBusinesses(b);
      setLoadingBiz(false);
      // Prefill location from the business when creating a new job.
      if (b[0]?.location && !editing) {
        setF((p) => ({ ...p, city: p.city || (b[0].location as string) }));
      }
    });
  }, [user.email, editing]);

  const biz = businesses[bizIndex];

  const submit = async (asDraft: boolean) => {
    setError("");
    if (!f.title.trim()) return setError("Please enter a job title.");
    if (!biz && !editing) return setError("No registered business found on your account.");
    if (f.application_method === "external" && !f.external_url.trim()) {
      return setError("Please add the external application link.");
    }
    setBusy(true);

    const payload = {
      owner_email: user.email,
      business_name: editing?.business_name ?? biz?.name ?? user.name,
      business_category: editing?.business_category ?? biz?.category ?? user.businessCategory ?? null,
      business_logo: editing?.business_logo ?? biz?.logo ?? null,
      business_verified: editing?.business_verified ?? biz?.verified ?? false,
      title: f.title.trim(),
      category: f.category || null,
      description: f.description.trim() || null,
      responsibilities: f.responsibilities.trim() || null,
      skills: f.skills.trim() || null,
      experience_level: f.experience_level || null,
      employment_type: f.employment_type,
      workplace_type: f.workplace_type,
      vacancies: Math.max(1, parseInt(f.vacancies, 10) || 1),
      salary_disclosed: f.salary_disclosed,
      salary_min: f.salary_disclosed && f.salary_min ? Number(f.salary_min) : null,
      salary_max: f.salary_disclosed && f.salary_max ? Number(f.salary_max) : null,
      salary_period: f.salary_period,
      district: f.district || null,
      city: f.city.trim() || null,
      deadline: f.deadline || null,
      contact_name: f.contact_name.trim() || null,
      contact_phone: f.contact_phone.trim() || null,
      contact_email: f.contact_email.trim() || null,
      cv_required: f.cv_required,
      application_method: f.application_method,
      external_url: f.external_url.trim() || null,
      status: (asDraft ? "draft" : "pending") as JobRow["status"],
    };

    const res = editing
      ? await updateJob(editing.id, payload)
      : await createJob(payload);
    setBusy(false);

    const err = (res as { error?: { message?: string; code?: string } | null }).error;
    if (err) {
      console.error("Job save failed:", err);
      const msg = err.message ?? "";
      // A missing table means the phase-62 migration hasn't been run yet.
      if (/relation .*jobs.* does not exist|schema cache/i.test(msg)) {
        setError(
          "The jobs table doesn't exist yet. Run supabase/phase62-jobs-portal.sql in Supabase, then try again."
        );
      } else {
        setError(msg ? `Could not save: ${msg}` : "Could not save the job. Please try again.");
      }
      return;
    }
    setDone(true);
    onDone?.();
  };

  if (done) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-premium">
        <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
        <h3 className="mt-3 font-display text-lg font-bold text-forest">
          {editing ? "Job updated" : "Job submitted for review"}
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Our team reviews every vacancy before it goes live on the Rego Jobs portal. You&apos;ll
          find it under <strong>My Jobs</strong>.
        </p>
        <button
          onClick={() => setDone(false)}
          className="mt-5 rounded-lg bg-gradient-forest px-5 py-2.5 text-sm font-semibold text-white"
        >
          Post another job
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">
          {editing ? "Edit job" : "Post a Job"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hire for your business. Jobs are reviewed by the Rego team before publishing.
        </p>
      </div>

      {/* Business (auto-linked) */}
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Posting as
        </span>
        {loadingBiz ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading your business…
          </p>
        ) : editing ? (
          <p className="font-display text-sm font-bold text-forest">{editing.business_name}</p>
        ) : businesses.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-amber-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            No registered business found. Add your listing first, then post a job.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {biz?.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={biz.logo} alt="" className="h-11 w-11 rounded-xl object-cover" />
            )}
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-forest">{biz?.name}</p>
              <p className="text-xs text-muted-foreground">
                {biz?.location ?? "Gilgit-Baltistan"} · {biz?.verified ? "Verified" : "Unverified"}
              </p>
            </div>
            {businesses.length > 1 && (
              <select
                className="auth-input ml-auto max-w-[240px]"
                value={bizIndex}
                onChange={(e) => setBizIndex(Number(e.target.value))}
              >
                {businesses.map((b, i) => (
                  <option key={`${b.name}-${i}`} value={i}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="grid gap-3 rounded-3xl border border-border bg-card p-5 shadow-premium sm:grid-cols-2">
        <L label="Job title *" full>
          <input className="auth-input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Hotel Receptionist" />
        </L>
        <L label="Job category">
          <select className="auth-input" value={f.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Choose…</option>
            {JOB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </L>
        <L label="Employment type">
          <select className="auth-input" value={f.employment_type} onChange={(e) => set("employment_type", e.target.value)}>
            {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </L>
        <L label="Workplace type">
          <select className="auth-input" value={f.workplace_type} onChange={(e) => set("workplace_type", e.target.value)}>
            {WORKPLACE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </L>
        <L label="Experience level">
          <select className="auth-input" value={f.experience_level} onChange={(e) => set("experience_level", e.target.value)}>
            <option value="">Any</option>
            {EXPERIENCE_LEVELS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </L>
        <L label="Number of vacancies">
          <input type="number" min={1} className="auth-input" value={f.vacancies} onChange={(e) => set("vacancies", e.target.value)} />
        </L>
        <L label="Application deadline">
          <input type="date" className="auth-input" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </L>

        <L label="Short description" full>
          <textarea rows={3} className="auth-input resize-none" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="What is this role about?" />
        </L>
        <L label="Responsibilities" full>
          <textarea rows={3} className="auth-input resize-none" value={f.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} placeholder="One per line" />
        </L>
        <L label="Required skills" full>
          <textarea rows={2} className="auth-input resize-none" value={f.skills} onChange={(e) => set("skills", e.target.value)} placeholder="e.g. English, guest handling, MS Office" />
        </L>

        {/* Salary */}
        <div className="rounded-2xl border border-border bg-muted/20 p-3 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-forest">
            <input type="checkbox" checked={!f.salary_disclosed} onChange={(e) => set("salary_disclosed", !e.target.checked)} />
            Salary not disclosed
          </label>
          {f.salary_disclosed && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <L label="Salary from (PKR)">
                <input type="number" className="auth-input" value={f.salary_min} onChange={(e) => set("salary_min", e.target.value)} placeholder="40000" />
              </L>
              <L label="Salary to (PKR)">
                <input type="number" className="auth-input" value={f.salary_max} onChange={(e) => set("salary_max", e.target.value)} placeholder="60000" />
              </L>
              <L label="Per">
                <select className="auth-input" value={f.salary_period} onChange={(e) => set("salary_period", e.target.value)}>
                  {SALARY_PERIODS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </L>
            </div>
          )}
        </div>

        <L label="District">
          {/* Real districts from the locations table, not a hand-kept copy. */}
          <DistrictSelect value={f.district} onChange={(v) => set("district", v)} />
        </L>
        <L label="City / area">
          <input className="auth-input" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Skardu" />
        </L>

        <L label="Contact person">
          <input className="auth-input" value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
        </L>
        <L label="Contact phone">
          <input className="auth-input" value={f.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+92 3xx xxxxxxx" />
        </L>
        <L label="Contact email" full>
          <input type="email" className="auth-input" value={f.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
        </L>

        <L label="How should people apply?">
          <select className="auth-input" value={f.application_method} onChange={(e) => set("application_method", e.target.value)}>
            <option value="rego">Through Rego (recommended)</option>
            <option value="email">By email</option>
            <option value="phone">By phone</option>
            <option value="external">External website</option>
          </select>
        </L>
        {f.application_method === "external" ? (
          <L label="External application link">
            <input className="auth-input" value={f.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://…" />
          </L>
        ) : (
          <L label="CV required?">
            <select className="auth-input" value={f.cv_required ? "yes" : "no"} onChange={(e) => set("cv_required", e.target.value === "yes")}>
              <option value="yes">Yes — CV required</option>
              <option value="no">No — form only</option>
            </select>
          </L>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600 sm:col-span-2">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="button" variant="gold" className="rounded-lg" disabled={busy} onClick={() => submit(false)}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Briefcase className="h-4 w-4" /> {editing ? "Save changes" : "Submit for approval"}</>}
          </Button>
          {!editing && (
            <button type="button" onClick={() => submit(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-forest hover:bg-muted">
              <Save className="h-4 w-4" /> Save as draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 2) MY JOBS
 * ============================================================ */
export function ProviderMyJobs({ user }: { user: DashUser }) {
  const [rows, setRows] = React.useState<JobRow[] | null>(null);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<JobRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setRows(await getMyJobs(user.email));
  }, [user.email]);

  React.useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await load();
    setBusyId(null);
  };

  if (editing) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted">
          ← Back to My Jobs
        </button>
        <ProviderPostJob user={user} editing={editing} onDone={() => { setEditing(null); load(); }} />
      </div>
    );
  }

  const list = (rows ?? []).filter((j) =>
    !q.trim() || `${j.title} ${j.category ?? ""} ${j.city ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">My Jobs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every vacancy you&apos;ve posted, with its review status.
        </p>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your jobs…" className="w-full bg-transparent text-sm focus:outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{list.length}</span>
      </label>

      {rows === null ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No jobs yet — use <strong>Post a Job</strong> to hire for your business.</p>
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
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {j.category ?? "—"} · {jobLocation(j)} · {j.employment_type} · {salaryLabel(j)}
                    </p>
                    {j.deadline && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Deadline {new Date(j.deadline).toLocaleDateString("en-GB")}
                      </p>
                    )}
                    {j.admin_note && (
                      <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
                        <strong>Admin note:</strong> {j.admin_note}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {j.status === "published" && j.slug && (
                      <Link href={`/jobs/${j.slug}`} target="_blank" title="View live" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    <button onClick={() => setEditing(j)} title="Edit" className="rounded-md border border-border p-1.5 text-forest hover:bg-muted">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {j.status === "changes_required" && (
                      <button disabled={rowBusy} onClick={() => act(j.id, () => resubmitJob(j.id))} className="rounded-lg border border-forest-200 bg-forest-50 px-2.5 py-1.5 text-xs font-bold text-forest-700 hover:bg-forest-100">
                        Resubmit
                      </button>
                    )}
                    {j.status === "published" && (
                      <button disabled={rowBusy} onClick={() => act(j.id, () => updateJob(j.id, { status: "paused" }))} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-forest hover:bg-muted">
                        Pause
                      </button>
                    )}
                    {j.status === "paused" && (
                      <button disabled={rowBusy} onClick={() => act(j.id, () => updateJob(j.id, { status: "published" }))} className="rounded-lg border border-forest-200 bg-forest-50 px-2.5 py-1.5 text-xs font-bold text-forest-700 hover:bg-forest-100">
                        Resume
                      </button>
                    )}
                    <button
                      disabled={rowBusy}
                      onClick={() => { if (window.confirm(`Delete "${j.title}"?`)) act(j.id, () => deleteJob(j.id)); }}
                      title="Delete"
                      className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * 3) JOB APPLICATIONS
 * ============================================================ */
export function ProviderJobApplications({ user }: { user: DashUser }) {
  const [rows, setRows] = React.useState<JobApplicantRow[] | null>(null);
  const [jobs, setJobs] = React.useState<JobRow[]>([]);
  const [jobFilter, setJobFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | ApplicantStatus>("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");

  const load = React.useCallback(async () => {
    const [apps, myJobs] = await Promise.all([
      getApplicantsForOwner(user.email),
      getMyJobs(user.email),
    ]);
    setRows(apps);
    setJobs(myJobs);
  }, [user.email]);

  React.useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    await load();
    setBusyId(null);
  };

  const list = (rows ?? []).filter((a) => {
    if (jobFilter !== "all" && a.job_id !== jobFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return (
      a.full_name.toLowerCase().includes(t) ||
      a.email.toLowerCase().includes(t) ||
      (a.location ?? "").toLowerCase().includes(t) ||
      (a.job_title ?? "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Job Applications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone who applied to your vacancies.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="auth-input max-w-[260px]" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
          <option value="all">All jobs</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        {(["all", ...APPLICANT_STATUSES.map((s) => s.value)] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s as "all" | ApplicantStatus)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              statusFilter === s ? "bg-gradient-forest text-white" : "border border-border bg-card text-forest hover:bg-muted"
            )}
          >
            {s === "all" ? "All" : APPLICANT_STATUSES.find((x) => x.value === s)?.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search applicants…" className="w-full bg-transparent text-sm focus:outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{list.length}</span>
      </label>

      {rows === null ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No applications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const open = openId === a.id;
            const meta = APPLICANT_STATUSES.find((s) => s.value === a.status);
            const rowBusy = busyId === a.id;
            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card shadow-premium">
                <button onClick={() => setOpenId(open ? null : a.id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-forest">{a.full_name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", meta?.tone)}>{meta?.label ?? a.status}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.job_title} · {a.location || "—"} · {new Date(a.created_at).toLocaleDateString("en-GB")}
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
                      {a.location && (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 text-forest-600" /> {a.location}
                        </span>
                      )}
                      {a.cv_url && (
                        <a href={a.cv_url} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-2 font-semibold text-forest-600 hover:text-gold">
                          <FileText className="h-4 w-4" /> View / download CV
                        </a>
                      )}
                    </div>

                    {a.intro && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Introduction</p>
                        <p className="mt-0.5 whitespace-pre-line text-sm text-forest-800">{a.intro}</p>
                      </div>
                    )}
                    {a.cover_letter && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cover letter</p>
                        <p className="mt-0.5 whitespace-pre-line text-sm text-forest-800">{a.cover_letter}</p>
                      </div>
                    )}

                    <label className="mt-3 block">
                      <span className="mb-1 block text-xs font-semibold text-muted-foreground">Private note</span>
                      <textarea
                        rows={2}
                        defaultValue={a.provider_note ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== (a.provider_note ?? "")) act(a.id, () => setApplicantNote(a.id, e.target.value));
                        }}
                        className="auth-input resize-none"
                        placeholder="Notes for your team (saved when you click away)…"
                      />
                    </label>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Status:</span>
                      {APPLICANT_STATUSES.map((s) => (
                        <button
                          key={s.value}
                          disabled={rowBusy}
                          onClick={() => act(a.id, () => setApplicantStatus(a.id, s.value))}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                            a.status === s.value ? "bg-gradient-forest text-white" : "border border-border text-forest hover:bg-muted"
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
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

function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
