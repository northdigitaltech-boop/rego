"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  X,
  Loader2,
  CheckCircle2,
  UploadCloud,
  FileText,
  Link as LinkIcon,
} from "lucide-react";

import {
  submitApplication,
  CAREERS_EMAIL,
  MARKETING_SKILLS,
  SCREENING_QUESTIONS,
} from "@/lib/careers";
import { uploadFileToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { sendEmail } from "@/lib/email";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { alertJobApplication } from "@/lib/admin-alerts";

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

export function ApplyButton({
  jobId,
  jobTitle,
  department,
  label = "Apply now",
  className,
}: {
  jobId?: string;
  jobTitle: string;
  department?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg bg-gradient-forest px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5",
          className
        )}
      >
        {label} <ArrowRight className="h-4 w-4" />
      </button>
      {open && (
        <ApplyModal
          jobId={jobId}
          jobTitle={jobTitle}
          department={department}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ApplyModal({
  jobId,
  jobTitle,
  department,
  onClose,
}: {
  jobId?: string;
  jobTitle: string;
  department?: string;
  onClose: () => void;
}) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [city, setCity] = React.useState("");
  const [experience, setExperience] = React.useState("");
  const [cover, setCover] = React.useState("");

  // Marketing screening
  const [skills, setSkills] = React.useState<string[]>([]);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [portfolio, setPortfolio] = React.useState("");

  const toggleSkill = (s: string) =>
    setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const [cvUrl, setCvUrl] = React.useState("");
  const [cvName, setCvName] = React.useState("");
  const [cvLink, setCvLink] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");

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
    setBusy(true);
    const finalCv = cvUrl || cvLink.trim();
    const { error: err } = await submitApplication({
      job_id: jobId ?? null,
      job_title: jobTitle,
      department: department ?? null,
      full_name: fullName,
      email,
      phone,
      city,
      experience,
      cover_note: cover,
      cv_url: finalCv || null,
      skills,
      ran_paid_ads: answers.ran_paid_ads ?? null,
      tourism_exp: answers.tourism_exp ?? null,
      has_vehicle: answers.has_vehicle ?? null,
      can_travel: answers.can_travel ?? null,
      portfolio_url: portfolio,
    });
    if (err) {
      setBusy(false);
      // Surface the real reason so setup problems are obvious (e.g. the
      // job_applications table/columns not created yet).
      const msg = (err as { message?: string })?.message ?? "";
      console.error("Application submit failed:", err);
      setError(
        msg
          ? `Could not submit: ${msg}`
          : "Could not submit your application. Please try again."
      );
      return;
    }

    // Notify the careers inbox (best-effort — never blocks the applicant).
    sendEmail(
      CAREERS_EMAIL,
      `New application: ${jobTitle}`,
      `<p><strong>${fullName}</strong> applied for <strong>${jobTitle}</strong>.</p>
       <p><strong>Email:</strong> ${email}<br/>
       <strong>Phone:</strong> ${phone || "—"}<br/>
       <strong>City:</strong> ${city || "—"}</p>
       <p><strong>Skills:</strong> ${skills.length ? skills.join(", ") : "—"}</p>
       <p>${SCREENING_QUESTIONS.map(
         (q) => `<strong>${q.label}</strong> ${answers[q.key] ?? "—"}`
       ).join("<br/>")}</p>
       ${portfolio ? `<p><strong>Portfolio:</strong> <a href="${portfolio}">${portfolio}</a></p>` : ""}
       <p><strong>Experience:</strong><br/>${(experience || "—").replace(/\n/g, "<br/>")}</p>
       <p><strong>Cover note:</strong><br/>${(cover || "—").replace(/\n/g, "<br/>")}</p>
       ${finalCv ? `<p><a href="${finalCv}">View CV</a></p>` : "<p>No CV attached.</p>"}
       <p>Review it in the admin dashboard → Applications.</p>`
    ).catch(() => {});

    setBusy(false);
    setSent(true);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-premium-lg sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-forest">Apply for this role</h3>
              <p className="truncate text-xs text-muted-foreground">{jobTitle}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted-foreground hover:text-forest">
              <X className="h-5 w-5" />
            </button>
          </div>

          {sent ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
              <h4 className="mt-3 font-display text-lg font-bold text-forest">Application received</h4>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Thank you, {fullName.split(" ")[0]}. Our team reviews every application and will contact
                you at <strong>{email}</strong> if you're shortlisted.
              </p>
              <button
                onClick={onClose}
                className="mt-5 rounded-lg bg-gradient-forest px-5 py-2.5 text-sm font-semibold text-white"
              >
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
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Phone / WhatsApp</span>
                <input className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">City / Region</span>
                <input className="auth-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Skardu" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Relevant experience</span>
                <textarea rows={3} className="auth-input resize-none" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Years of experience, past roles, tourism/marketing background…" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Why you? (short note)</span>
                <textarea rows={3} className="auth-input resize-none" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="Tell us why you're a great fit for this role…" />
              </label>

              {/* Marketing skills — multi-select */}
              <div className="rounded-2xl border border-border bg-muted/30 p-3 sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-muted-foreground">
                  Which of these can you do? (tick all that apply)
                </span>
                <div className="flex flex-wrap gap-2">
                  {MARKETING_SKILLS.map((s) => {
                    const on = skills.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSkill(s)}
                        aria-pressed={on}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                          on
                            ? "border-forest-600 bg-gradient-forest text-white"
                            : "border-border bg-card text-forest hover:border-gold/60 hover:text-gold"
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Yes / No / Some screening */}
              <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-3 sm:col-span-2">
                {SCREENING_QUESTIONS.map((q) => (
                  <div key={q.key}>
                    <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                      {q.label}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt) => {
                        const on = answers[q.key] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswers((a) => ({ ...a, [q.key]: opt }))}
                            aria-pressed={on}
                            className={cn(
                              "min-w-[68px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                              on
                                ? "border-forest-600 bg-forest-600 text-white"
                                : "border-border bg-card text-forest hover:bg-muted"
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Portfolio / page you&apos;ve managed (optional)
                </span>
                <input
                  className="auth-input"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  placeholder="Facebook page, Instagram, website or campaign link"
                />
              </label>

              {/* CV — upload a file or paste a link */}
              <div className="rounded-2xl border border-border bg-muted/30 p-3 sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-muted-foreground">
                  CV / Resume — upload a file or paste a link
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
                      <button
                        type="button"
                        onClick={() => {
                          setCvUrl("");
                          setCvName("");
                        }}
                        aria-label="Remove CV"
                        className="text-muted-foreground hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    aria-label="Upload your CV"
                    accept=".pdf,.doc,.docx,application/pdf"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </div>
                {!cvUrl && (
                  <label className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      className="w-full bg-transparent text-sm text-forest focus:outline-none"
                      value={cvLink}
                      onChange={(e) => setCvLink(e.target.value)}
                      placeholder="…or paste a Google Drive / LinkedIn link"
                    />
                  </label>
                )}
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
                  By applying you agree that Rego may contact you about this role.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </Portal>
  );
}
