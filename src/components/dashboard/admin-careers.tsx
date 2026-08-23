"use client";

import * as React from "react";
import { Save, Plus, Trash2, Check, Loader2, Info, Briefcase } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getJobOpenings, saveJobOpenings, type JobOpening } from "@/lib/careers";

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="auth-input" />
    </label>
  );
}
function Area({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className="auth-input resize-y" />
    </label>
  );
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || `job-${Date.now()}`;

export function AdminCareers() {
  const [jobs, setJobs] = React.useState<JobOpening[] | null>(null);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");

  React.useEffect(() => {
    getJobOpenings().then(setJobs);
  }, []);

  const patch = (i: number, fn: (j: JobOpening) => void) =>
    setJobs((prev) => {
      if (!prev) return prev;
      const n = structuredClone(prev);
      fn(n[i]);
      return n;
    });

  const add = () =>
    setJobs((prev) => [
      ...(prev ?? []),
      {
        id: `job-${Date.now()}`,
        title: "New Position",
        department: "General",
        location: "Gilgit-Baltistan",
        type: "Full-time",
        summary: "",
        responsibilities: [""],
      },
    ]);

  const remove = (i: number) => setJobs((prev) => (prev ?? []).filter((_, j) => j !== i));

  const save = async () => {
    if (!jobs) return;
    setStatus("saving");
    // Ensure every job has a stable id derived from its title if blank.
    const clean = jobs.map((j) => ({ ...j, id: j.id || slugify(j.title), responsibilities: j.responsibilities.filter((r) => r.trim()) }));
    const { error } = await saveJobOpenings(clean);
    setStatus(error ? "error" : "saved");
    if (!error) setTimeout(() => setStatus("idle"), 2500);
  };

  if (!jobs) {
    return (
      <div className="grid h-40 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-forest"><Briefcase className="h-5 w-5 text-forest-600" /> Careers &amp; Job Openings</h2>
          <p className="text-sm text-muted-foreground">Post, edit or remove open roles on the public /careers page. Changes go live within a minute.</p>
        </div>
        <div className="flex items-center gap-2">
          {status === "saved" && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600"><Check className="h-4 w-4" /> Saved</span>}
          {status === "error" && <span className="text-sm font-semibold text-red-600">Save failed</span>}
          <Button variant="outline" onClick={add}><Plus className="h-4 w-4" /> Add role</Button>
          <Button variant="gold" onClick={save} disabled={status === "saving"}>
            {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        To close a role, delete it and Save. Roles are grouped by the <strong>Department</strong> field on the public page. Applications appear in the Applications tab, and a copy is emailed to you.
      </p>

      {jobs.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No open roles. Click “Add role” to post one.</p>
      )}

      <div className="space-y-4">
        {jobs.map((job, i) => (
          <section key={i} className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-forest">{job.title || "Untitled role"}</h3>
              <button onClick={() => remove(i)} aria-label="Remove role" className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Job title" value={job.title} onChange={(v) => patch(i, (j) => { j.title = v; })} />
              <Field label="Department" value={job.department} onChange={(v) => patch(i, (j) => { j.department = v; })} placeholder="Marketing" />
              <Field label="Location" value={job.location} onChange={(v) => patch(i, (j) => { j.location = v; })} placeholder="Skardu, Baltistan" />
              <Field label="Type" value={job.type} onChange={(v) => patch(i, (j) => { j.type = v; })} placeholder="Full-time" />
            </div>
            <div className="mt-3">
              <Area label="Summary" value={job.summary} onChange={(v) => patch(i, (j) => { j.summary = v; })} rows={3} />
            </div>
            <div className="mt-3">
              <span className="mb-1 block text-xs font-semibold text-forest">Key responsibilities</span>
              <div className="space-y-2">
                {job.responsibilities.map((r, ri) => (
                  <div key={ri} className="flex gap-2">
                    <input value={r} onChange={(e) => patch(i, (j) => { j.responsibilities[ri] = e.target.value; })} className="auth-input" />
                    <button onClick={() => patch(i, (j) => { j.responsibilities.splice(ri, 1); })} aria-label="Remove responsibility" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => patch(i, (j) => { j.responsibilities.push(""); })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest-600 hover:text-gold"><Plus className="h-3.5 w-3.5" /> Add point</button>
            </div>
          </section>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="gold" onClick={save} disabled={status === "saving"}>
          {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
        </Button>
      </div>
    </div>
  );
}
