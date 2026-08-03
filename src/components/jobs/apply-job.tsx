"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  X,
  Loader2,
  CheckCircle2,
  UploadCloud,
  FileText,
  ArrowRight,
  Mail,
  Phone,
  ExternalLink,
} from "lucide-react";

import { applyToJob, isExpired, type JobRow } from "@/lib/jobs";
import { uploadFileToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { sendEmail } from "@/lib/email";
import { useAuth } from "@/components/auth/auth-context";
import { useScrollLock } from "@/lib/use-scroll-lock";

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  // Pins the page (iOS included) and restores the scroll position on close.
  useScrollLock(true);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/** Apply Now — respects the job's application method and deadline. */
export function ApplyJobButton({ job }: { job: JobRow }) {
  const [open, setOpen] = React.useState(false);
  const expired = isExpired(job) || job.status !== "published";

  if (expired) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
        Applications are closed for this job.
      </div>
    );
  }

  if (job.application_method === "external" && job.external_url) {
    return (
      <a
        href={job.external_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 text-sm font-bold text-forest-900 transition-transform hover:-translate-y-0.5"
      >
        Apply on their website <ExternalLink className="h-4 w-4" />
      </a>
    );
  }

  if (job.application_method === "email" && job.contact_email) {
    return (
      <a
        href={`mailto:${job.contact_email}?subject=${encodeURIComponent(`Application: ${job.title}`)}`}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 text-sm font-bold text-forest-900 transition-transform hover:-translate-y-0.5"
      >
        <Mail className="h-4 w-4" /> Apply by email
      </a>
    );
  }

  if (job.application_method === "phone" && job.contact_phone) {
    return (
      <a
        href={`tel:${job.contact_phone}`}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 text-sm font-bold text-forest-900 transition-transform hover:-translate-y-0.5"
      >
        <Phone className="h-4 w-4" /> Call {job.contact_phone}
      </a>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 text-sm font-bold text-forest-900 transition-transform hover:-translate-y-0.5"
      >
        Apply Now <ArrowRight className="h-4 w-4" />
      </button>
      {open && <ApplyModal job={job} onClose={() => setOpen(false)} />}
    </>
  );
}

function ApplyModal({ job, onClose }: { job: JobRow; onClose: () => void }) {
  const { user } = useAuth();
  const [fullName, setFullName] = React.useState(user?.name ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [phone, setPhone] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [intro, setIntro] = React.useState("");
  const [cover, setCover] = React.useState("");

  const [cvUrl, setCvUrl] = React.useState("");
  const [cvName, setCvName] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [sent, setSent] = React.useState(false);

  const pickFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Please upload a file under 5 MB.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const url = await uploadFileToCloudinary(file);
      setCvUrl(url);
      setCvName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    if (job.cv_required && !cvUrl) {
      setError("This employer requires a CV. Please upload one.");
      return;
    }
    setBusy(true);
    const { error: err } = await applyToJob(
      {
        job_id: job.id,
        job_title: job.title,
        owner_email: job.owner_email,
        full_name: fullName,
        email,
        phone,
        location,
        intro,
        cover_letter: cover,
        cv_url: cvUrl,
      },
      job
    );
    setBusy(false);
    if (err) {
      setError((err as Error).message || "Could not submit your application.");
      return;
    }

    // Notify the employer (best-effort).
    sendEmail(
      job.contact_email || job.owner_email,
      `New application: ${job.title}`,
      `<p><strong>${fullName}</strong> applied for <strong>${job.title}</strong>.</p>
       <p><strong>Email:</strong> ${email}<br/><strong>Phone:</strong> ${phone || "—"}<br/>
       <strong>Location:</strong> ${location || "—"}</p>
       ${intro ? `<p><strong>Introduction:</strong><br/>${intro.replace(/\n/g, "<br/>")}</p>` : ""}
       ${cvUrl ? `<p><a href="${cvUrl}">View CV</a></p>` : ""}
       <p>Manage applicants in your Rego dashboard → Job Applications.</p>`
    ).catch(() => {});

    setSent(true);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
        <div
          className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-premium-lg sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-forest">Apply for this job</h3>
              <p className="truncate text-xs text-muted-foreground">
                {job.title} · {job.business_name}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted-foreground hover:text-forest">
              <X className="h-5 w-5" />
            </button>
          </div>

          {sent ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
              <h4 className="mt-3 font-display text-lg font-bold text-forest">Application sent</h4>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {job.business_name} has received your application and will contact you at{" "}
                <strong>{email}</strong> if you&apos;re shortlisted.
              </p>
              <button onClick={onClose} className="mt-5 rounded-lg bg-gradient-forest px-5 py-2.5 text-sm font-semibold text-white">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-3 p-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Full name *</span>
                <input className="auth-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Email *</span>
                <input type="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Phone</span>
                <input className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Your location</span>
                <input className="auth-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Skardu" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Short introduction</span>
                <textarea rows={3} className="auth-input resize-none" value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Tell the employer about yourself and your experience…" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Cover letter (optional)</span>
                <textarea rows={3} className="auth-input resize-none" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="Why are you a great fit for this role?" />
              </label>

              <div className="rounded-2xl border border-border bg-muted/30 p-3 sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-muted-foreground">
                  CV / Resume {job.cv_required ? "*" : "(optional)"}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || !isCloudinaryConfigured}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-forest hover:bg-muted disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {uploading ? "Uploading…" : "Upload CV"}
                  </button>
                  {cvUrl && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-forest-50 px-2.5 py-1.5 text-xs font-semibold text-forest-700">
                      <FileText className="h-3.5 w-3.5" /> {cvName || "CV attached"}
                      <button type="button" onClick={() => { setCvUrl(""); setCvName(""); }} aria-label="Remove CV" className="text-muted-foreground hover:text-red-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                  <input ref={fileRef} type="file" aria-label="Upload your CV" accept=".pdf,.doc,.docx,application/pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                </div>
              </div>

              {error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy || uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-bold text-forest-900 disabled:opacity-50"
                >
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <>Submit application <ArrowRight className="h-4 w-4" /></>}
                </button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Your details are shared only with {job.business_name}.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </Portal>
  );
}
