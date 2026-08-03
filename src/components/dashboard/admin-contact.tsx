"use client";

import * as React from "react";
import { Loader2, Save, CheckCircle2, Plus, Trash2, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getContactContent,
  saveContactContent,
  DEFAULT_CONTACT,
  type ContactContent,
} from "@/lib/contact-content";
import { cn } from "@/lib/utils";

const PLATFORMS = ["facebook", "instagram", "youtube", "whatsapp", "tiktok", "linkedin", "x"];

/** Edit everything shown on the public /contact page. */
export function AdminContact() {
  const [c, setC] = React.useState<ContactContent | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    getContactContent().then(setC);
  }, []);

  const set = <K extends keyof ContactContent>(k: K, v: ContactContent[K]) =>
    setC((p) => (p ? { ...p, [k]: v } : p));

  const save = async () => {
    if (!c) return;
    setBusy(true);
    setNote(null);
    const { error } = await saveContactContent(c);
    setBusy(false);
    setNote(
      error
        ? {
            ok: false,
            text:
              (error as { message?: string })?.message ||
              "Could not save. Have you run supabase/phase63-contact-content.sql?",
          }
        : { ok: true, text: "Saved — the Contact page is updated." }
    );
  };

  if (!c) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">Contact Page</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything travellers see on the Contact page — updates go live immediately.
          </p>
        </div>
        <a
          href="/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-forest hover:bg-muted"
        >
          <ExternalLink className="h-4 w-4" /> View page
        </a>
      </div>

      {/* Hero */}
      <Card title="Header">
        <div className="grid gap-3 sm:grid-cols-2">
          <L label="Small script line">
            <input className="auth-input" value={c.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} />
          </L>
          <L label="Page title">
            <input className="auth-input" value={c.title} onChange={(e) => set("title", e.target.value)} />
          </L>
          <L label="Intro paragraph" full>
            <textarea rows={2} className="auth-input resize-none" value={c.intro} onChange={(e) => set("intro", e.target.value)} />
          </L>
        </div>
      </Card>

      {/* Contact details */}
      <Card title="Contact details">
        <div className="grid gap-3 sm:grid-cols-2">
          <L label="Section heading" full>
            <input className="auth-input" value={c.detailsHeading} onChange={(e) => set("detailsHeading", e.target.value)} />
          </L>
          <L label="Phone">
            <input className="auth-input" value={c.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+92 316 1290604" />
          </L>
          <L label="Email">
            <input type="email" className="auth-input" value={c.email} onChange={(e) => set("email", e.target.value)} />
          </L>
          <L label="Office / address">
            <input className="auth-input" value={c.office} onChange={(e) => set("office", e.target.value)} />
          </L>
          <L label="Opening hours">
            <input className="auth-input" value={c.hours} onChange={(e) => set("hours", e.target.value)} />
          </L>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The phone and email here are what customers actually tap — double-check them.
        </p>
      </Card>

      {/* Social links */}
      <Card title="Social links">
        <div className="grid gap-3 sm:grid-cols-2">
          <L label="Heading">
            <input className="auth-input" value={c.socialHeading} onChange={(e) => set("socialHeading", e.target.value)} />
          </L>
          <L label="Sub-text">
            <input className="auth-input" value={c.socialIntro} onChange={(e) => set("socialIntro", e.target.value)} />
          </L>
        </div>

        <div className="mt-3 space-y-2">
          {c.socials.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                className="auth-input max-w-[160px] capitalize"
                value={s.platform}
                onChange={(e) => {
                  const next = [...c.socials];
                  next[i] = { ...next[i], platform: e.target.value };
                  set("socials", next);
                }}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p} className="capitalize">
                    {p}
                  </option>
                ))}
              </select>
              <input
                className="auth-input min-w-[200px] flex-1"
                value={s.href}
                placeholder="https://…"
                onChange={(e) => {
                  const next = [...c.socials];
                  next[i] = { ...next[i], href: e.target.value };
                  set("socials", next);
                }}
              />
              <button
                onClick={() => set("socials", c.socials.filter((_, j) => j !== i))}
                title="Remove"
                className="rounded-md border border-red-200 p-2 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => set("socials", [...c.socials, { platform: "facebook", href: "" }])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Add social link
          </button>
        </div>
      </Card>

      {/* Form heading */}
      <Card title="Message form">
        <L label="Form heading">
          <input className="auth-input" value={c.formHeading} onChange={(e) => set("formHeading", e.target.value)} />
        </L>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="gold" className="rounded-lg" disabled={busy} onClick={save}>
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save changes</>}
        </Button>
        <button
          onClick={() => setC(DEFAULT_CONTACT)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-forest hover:bg-muted"
        >
          Reset to defaults
        </button>
        {note && (
          <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", note.ok ? "text-forest-600" : "text-red-600")}>
            {note.ok && <CheckCircle2 className="h-4 w-4" />}
            {note.text}
          </span>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-premium">
      <h3 className="font-display text-base font-bold text-forest">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
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
