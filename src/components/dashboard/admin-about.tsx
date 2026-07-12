"use client";

import * as React from "react";
import { Save, RotateCcw, Plus, Trash2, Check, Loader2, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/ui/image-upload";
import { getAboutContent, saveAboutContent, defaultAboutContent, type AboutContent } from "@/lib/about";

/* ---------------- small field helpers ---------------- */
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="auth-input" />
    </label>
  );
}
function Area({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className="auth-input resize-y" />
    </label>
  );
}
function StrList({ label, items, onChange, area }: { label: string; items: string[]; onChange: (v: string[]) => void; area?: boolean }) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            {area ? (
              <textarea value={it} rows={2} onChange={(e) => set(i, e.target.value)} className="auth-input resize-y" />
            ) : (
              <input value={it} onChange={(e) => set(i, e.target.value)} className="auth-input" />
            )}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-red-500 hover:bg-red-50" aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, ""])} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest-600 hover:text-gold">
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-forest">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function AdminAbout() {
  const [content, setContent] = React.useState<AboutContent | null>(null);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");

  React.useEffect(() => {
    getAboutContent().then(setContent);
  }, []);

  const patch = (fn: (d: AboutContent) => void) =>
    setContent((prev) => {
      if (!prev) return prev;
      const n: AboutContent = structuredClone(prev);
      fn(n);
      return n;
    });

  const save = async () => {
    if (!content) return;
    setStatus("saving");
    const { error } = await saveAboutContent(content);
    setStatus(error ? "error" : "saved");
    if (!error) setTimeout(() => setStatus("idle"), 2500);
  };

  if (!content) {
    return (
      <div className="grid h-40 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">About Page Content</h2>
          <p className="text-sm text-muted-foreground">Edit the public About Us section. Changes go live within a minute.</p>
        </div>
        <div className="flex items-center gap-2">
          {status === "saved" && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600"><Check className="h-4 w-4" /> Saved</span>}
          {status === "error" && <span className="text-sm font-semibold text-red-600">Save failed</span>}
          <Button variant="outline" onClick={() => setContent(structuredClone(defaultAboutContent))}>
            <RotateCcw className="h-4 w-4" /> Restore defaults
          </Button>
          <Button variant="gold" onClick={save} disabled={status === "saving"}>
            {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        The design and layout are fixed — you only edit the text, images and links here. Leave a field blank to hide optional content.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 1. Intro */}
        <Card title="Section 1 · About Rego">
          <Field label="Gold label" value={content.intro.label} onChange={(v) => patch((d) => { d.intro.label = v; })} />
          <Area label="Main heading" value={content.intro.heading} onChange={(v) => patch((d) => { d.intro.heading = v; })} />
          <StrList label="Description paragraphs" items={content.intro.paragraphs} area onChange={(v) => patch((d) => { d.intro.paragraphs = v; })} />
          <Field label="Tagline" value={content.intro.tagline} onChange={(v) => patch((d) => { d.intro.tagline = v; })} />
          <StrList label="Floating cards" items={content.intro.floatingCards} onChange={(v) => patch((d) => { d.intro.floatingCards = v; })} />
          {content.intro.ctas.map((c, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <Field label={`CTA ${i + 1} label`} value={c.label} onChange={(v) => patch((d) => { d.intro.ctas[i].label = v; })} />
              <Field label={`CTA ${i + 1} link`} value={c.href} onChange={(v) => patch((d) => { d.intro.ctas[i].href = v; })} />
            </div>
          ))}
        </Card>

        {/* 3. Founder card */}
        <Card title="Founder Profile Card">
          <div>
            <span className="mb-1 block text-xs font-semibold text-forest">Founder photo</span>
            <AvatarUpload value={content.founder.photo} onChange={(url) => patch((d) => { d.founder.photo = url; })} />
          </div>
          <Field label="Name" value={content.founder.name} onChange={(v) => patch((d) => { d.founder.name = v; })} />
          <Field label="Position" value={content.founder.position} onChange={(v) => patch((d) => { d.founder.position = v; })} />
          <Field label="Professional background" value={content.founder.background} onChange={(v) => patch((d) => { d.founder.background = v; })} />
          <Field label="Education" value={content.founder.education} onChange={(v) => patch((d) => { d.founder.education = v; })} />
          <Field label="Hometown" value={content.founder.hometown} onChange={(v) => patch((d) => { d.founder.hometown = v; })} />
          <Field label="Role in Rego" value={content.founder.role} onChange={(v) => patch((d) => { d.founder.role = v; })} />
          <Field label="Badge" value={content.founder.badge} onChange={(v) => patch((d) => { d.founder.badge = v; })} />
        </Card>
      </div>

      {/* 2. CEO message */}
      <Card title="Section 2 · Message from the CEO & Founder">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Section title" value={content.ceo.sectionTitle} onChange={(v) => patch((d) => { d.ceo.sectionTitle = v; })} />
          <Field label="CEO name" value={content.ceo.name} onChange={(v) => patch((d) => { d.ceo.name = v; })} />
          <Field label="CEO title line" value={content.ceo.title} onChange={(v) => patch((d) => { d.ceo.title = v; })} />
        </div>
        <div className="space-y-4">
          {content.ceo.blocks.map((b, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-muted/40 p-3">
              <Field label={`Block ${i + 1} heading`} value={b.heading} onChange={(v) => patch((d) => { d.ceo.blocks[i].heading = v; })} />
              <div className="mt-2">
                <StrList label="Paragraphs" items={b.paragraphs} area onChange={(v) => patch((d) => { d.ceo.blocks[i].paragraphs = v; })} />
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Signature name (script font)" value={content.ceo.signature.name} onChange={(v) => patch((d) => { d.ceo.signature.name = v; })} />
          <div><StrList label="Signature lines" items={content.ceo.signature.lines} onChange={(v) => patch((d) => { d.ceo.signature.lines = v; })} /></div>
          <Field label="Achievement label" value={content.ceo.achievement.label} onChange={(v) => patch((d) => { d.ceo.achievement.label = v; })} />
          <Area label="Achievement description" value={content.ceo.achievement.description} onChange={(v) => patch((d) => { d.ceo.achievement.description = v; })} />
        </div>
      </Card>

      {/* 4. Highlights */}
      <Card title="Section 4 · Founder Highlights">
        <div className="grid gap-3 sm:grid-cols-2">
          {content.highlights.map((h, i) => (
            <div key={h.key} className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-2">
              <Field label={`Highlight ${i + 1} title`} value={h.title} onChange={(v) => patch((d) => { d.highlights[i].title = v; })} />
              <Area label="Description" value={h.description} onChange={(v) => patch((d) => { d.highlights[i].description = v; })} />
            </div>
          ))}
        </div>
      </Card>

      {/* 5. Mission & Vision */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Section 5 · Our Mission">
          <Field label="Label" value={content.mission.label} onChange={(v) => patch((d) => { d.mission.label = v; })} />
          <Area label="Heading" value={content.mission.heading} onChange={(v) => patch((d) => { d.mission.heading = v; })} />
          <Area label="Statement" value={content.mission.body} rows={5} onChange={(v) => patch((d) => { d.mission.body = v; })} />
        </Card>
        <Card title="Section 5 · Our Vision">
          <Field label="Label" value={content.vision.label} onChange={(v) => patch((d) => { d.vision.label = v; })} />
          <Area label="Heading" value={content.vision.heading} onChange={(v) => patch((d) => { d.vision.heading = v; })} />
          <Area label="Statement" value={content.vision.body} rows={5} onChange={(v) => patch((d) => { d.vision.body = v; })} />
        </Card>
      </div>

      {/* 6. Values */}
      <Card title="Section 6 · Core Values">
        <div className="grid gap-3 sm:grid-cols-2">
          {content.values.map((val, i) => (
            <div key={val.key} className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-2">
              <Field label={`Value ${i + 1} title`} value={val.title} onChange={(v) => patch((d) => { d.values[i].title = v; })} />
              <Area label="Description" value={val.description} onChange={(v) => patch((d) => { d.values[i].description = v; })} />
            </div>
          ))}
        </div>
      </Card>

      {/* 7. Ecosystem */}
      <Card title="Section 7 · The Rego Ecosystem">
        <Field label="Label" value={content.ecosystem.label} onChange={(v) => patch((d) => { d.ecosystem.label = v; })} />
        <Area label="Heading" value={content.ecosystem.heading} onChange={(v) => patch((d) => { d.ecosystem.heading = v; })} />
        <Area label="Description" value={content.ecosystem.description} onChange={(v) => patch((d) => { d.ecosystem.description = v; })} />
        <div className="grid gap-3 sm:grid-cols-2">
          {content.ecosystem.services.map((s, i) => (
            <div key={s.key} className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-2">
              <Field label={`Service ${i + 1} name`} value={s.name} onChange={(v) => patch((d) => { d.ecosystem.services[i].name = v; })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-forest">Status</span>
                  <select value={s.status} onChange={(e) => patch((d) => { d.ecosystem.services[i].status = e.target.value as "active" | "soon"; })} className="auth-input">
                    <option value="active">Active (highlighted)</option>
                    <option value="soon">Coming soon</option>
                  </select>
                </label>
                <Field label="Status badge" value={s.statusLabel} onChange={(v) => patch((d) => { d.ecosystem.services[i].statusLabel = v; })} />
              </div>
              <Area label="Description" value={s.description} onChange={(v) => patch((d) => { d.ecosystem.services[i].description = v; })} />
              <Field label="Link (optional)" value={s.href ?? ""} onChange={(v) => patch((d) => { d.ecosystem.services[i].href = v || undefined; })} />
            </div>
          ))}
        </div>
      </Card>

      {/* 8. Banner */}
      <Card title="Section 8 · Building a Digital Gilgit-Baltistan (banner)">
        <Field label="Heading" value={content.banner.heading} onChange={(v) => patch((d) => { d.banner.heading = v; })} />
        <Area label="Description" value={content.banner.description} rows={4} onChange={(v) => patch((d) => { d.banner.description = v; })} />
        {content.banner.ctas.map((c, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <Field label={`CTA ${i + 1} label`} value={c.label} onChange={(v) => patch((d) => { d.banner.ctas[i].label = v; })} />
            <Field label={`CTA ${i + 1} link`} value={c.href} onChange={(v) => patch((d) => { d.banner.ctas[i].href = v; })} />
          </div>
        ))}
      </Card>

      {/* Sticky save at bottom for long form */}
      <div className="flex justify-end">
        <Button variant="gold" onClick={save} disabled={status === "saving"}>
          {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
        </Button>
      </div>
    </div>
  );
}
