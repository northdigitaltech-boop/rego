"use client";

import * as React from "react";
import {
  Loader2, Plus, Trash2, Save, Eye, EyeOff, ExternalLink, Megaphone, GripVertical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  getAllAdSlides, createAdSlide, updateAdSlide, deleteAdSlide,
  type AdSlideRow,
} from "@/lib/ad-slides";
import { cn } from "@/lib/utils";

const EMPTY = {
  image: "",
  eyebrow: "",
  title: "",
  subtitle: "",
  badges: "",
  cta_label: "",
  cta_href: "",
  cta_external: false,
  advertiser: "",
  active: true,
  sort_order: 0,
  starts_at: "",
  ends_at: "",
};

/** Manage the sponsored slides shown on the homepage carousel. */
export function AdminAds() {
  const [rows, setRows] = React.useState<AdSlideRow[] | null>(null);
  const [f, setF] = React.useState({ ...EMPTY });
  const [editing, setEditing] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  const load = React.useCallback(async () => setRows(await getAllAdSlides()), []);
  React.useEffect(() => { load(); }, [load]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const reset = () => { setF({ ...EMPTY }); setEditing(null); };

  const save = async () => {
    setNote(null);
    if (!f.image.trim()) return setNote({ ok: false, text: "Please add a slide image." });
    if (!f.title.trim()) return setNote({ ok: false, text: "Please add a title." });
    setBusy(true);
    const payload = {
      image: f.image.trim(),
      eyebrow: f.eyebrow.trim() || null,
      title: f.title.trim(),
      subtitle: f.subtitle.trim() || null,
      badges: f.badges.split(",").map((b) => b.trim()).filter(Boolean),
      cta_label: f.cta_label.trim() || null,
      cta_href: f.cta_href.trim() || null,
      cta_external: f.cta_external,
      advertiser: f.advertiser.trim() || null,
      active: f.active,
      sort_order: Number(f.sort_order) || 0,
      starts_at: f.starts_at || null,
      ends_at: f.ends_at || null,
    };
    const { error } = editing
      ? await updateAdSlide(editing, payload)
      : await createAdSlide(payload);
    setBusy(false);
    if (error) {
      setNote({
        ok: false,
        text:
          (error as { message?: string })?.message ||
          "Could not save. Have you run supabase/phase64-ad-slides.sql?",
      });
      return;
    }
    setNote({ ok: true, text: editing ? "Slide updated." : "Slide added." });
    reset();
    load();
  };

  const edit = (s: AdSlideRow) => {
    setEditing(s.id);
    setF({
      image: s.image ?? "",
      eyebrow: s.eyebrow ?? "",
      title: s.title ?? "",
      subtitle: s.subtitle ?? "",
      badges: (s.badges ?? []).join(", "),
      cta_label: s.cta_label ?? "",
      cta_href: s.cta_href ?? "",
      cta_external: s.cta_external,
      advertiser: s.advertiser ?? "",
      active: s.active,
      sort_order: s.sort_order,
      starts_at: s.starts_at ?? "",
      ends_at: s.ends_at ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">Promotions & Advertising</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sponsored slides on the homepage, shown after Transport. Slides rotate every 5 seconds.
          </p>
        </div>
        <a href="/#promotions" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-forest hover:bg-muted">
          <ExternalLink className="h-4 w-4" /> View on site
        </a>
      </div>

      {/* Editor */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-premium">
        <h3 className="font-display text-base font-bold text-forest">
          {editing ? "Edit slide" : "New slide"}
        </h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Slide image * — wide landscape works best (about 1400×500)
            </span>
            <ImageUpload value={f.image} onChange={(url) => set("image", url)} />
          </div>

          <L label="Small line above the title">
            <input className="auth-input" value={f.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder="e.g. Sponsored" />
          </L>
          <L label="Title *">
            <input className="auth-input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Hotels on IndiGo" />
          </L>
          <L label="Subtitle" full>
            <textarea rows={2} className="auth-input resize-none" value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="One or two lines of supporting copy." />
          </L>
          <L label="Feature badges (comma separated)" full>
            <input className="auth-input" value={f.badges} onChange={(e) => set("badges", e.target.value)} placeholder="7 lakh+ hotels, Free cancellation" />
          </L>

          <L label="Button text">
            <input className="auth-input" value={f.cta_label} onChange={(e) => set("cta_label", e.target.value)} placeholder="Book now" />
          </L>
          <L label="Button link">
            <input className="auth-input" value={f.cta_href} onChange={(e) => set("cta_href", e.target.value)} placeholder="/categories/hotels or https://…" />
          </L>

          <L label="Advertiser name (optional credit)">
            <input className="auth-input" value={f.advertiser} onChange={(e) => set("advertiser", e.target.value)} placeholder="e.g. IndiGo" />
          </L>
          <L label="Order (lower shows first)">
            <input type="number" className="auth-input" value={f.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
          </L>

          <L label="Start date (optional)">
            <input type="date" className="auth-input" value={f.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
          </L>
          <L label="End date (optional)">
            <input type="date" className="auth-input" value={f.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
          </L>

          <label className="flex items-center gap-2 text-sm text-forest">
            <input type="checkbox" checked={f.cta_external} onChange={(e) => set("cta_external", e.target.checked)} />
            External link (opens in a new tab)
          </label>
          <label className="flex items-center gap-2 text-sm text-forest">
            <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
            Active (visible on the homepage)
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="gold" className="rounded-lg" disabled={busy} onClick={save}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  : <>{editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editing ? "Save changes" : "Add slide"}</>}
          </Button>
          {editing && (
            <button onClick={reset} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-forest hover:bg-muted">
              Cancel
            </button>
          )}
          {note && (
            <span className={cn("text-sm font-semibold", note.ok ? "text-forest-600" : "text-red-600")}>
              {note.text}
            </span>
          )}
        </div>
      </div>

      {/* Existing slides */}
      {rows === null ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No promotion slides yet. The section stays hidden until you add one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-premium">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image} alt="" className="h-16 w-28 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-sm font-bold text-forest">{s.title}</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                    s.active ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground")}>
                    {s.active ? "Active" : "Hidden"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">order {s.sort_order}</span>
                </div>
                {s.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.subtitle}</p>}
                {(s.starts_at || s.ends_at) && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {s.starts_at ? new Date(s.starts_at).toLocaleDateString() : "always"} –{" "}
                    {s.ends_at ? new Date(s.ends_at).toLocaleDateString() : "no end"}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => updateAdSlide(s.id, { active: !s.active }).then(load)}
                  title={s.active ? "Hide" : "Show"}
                  className="rounded-md border border-border p-1.5 text-forest hover:bg-muted">
                  {s.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => edit(s)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-forest hover:bg-muted">
                  Edit
                </button>
                <button
                  onClick={() => { if (window.confirm(`Delete "${s.title}"?`)) deleteAdSlide(s.id).then(load); }}
                  title="Delete"
                  className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
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
