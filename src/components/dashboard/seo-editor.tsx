"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";

import {
  EMPTY_SEO,
  getListingCount,
  getSeo,
  saveSeo,
  type LocationRow,
  type SeoDraft,
  type ServiceCategoryRow,
} from "@/lib/markets";
import { contentLength, decideIndexable } from "@/lib/location-seo";
import { cn } from "@/lib/utils";

/* ============================================================
 * SEO editor for a location, or a location + service page.
 *
 * ---------------------------------------------------------------------------
 * THE INDEXABILITY VERDICT IS THE MOST IMPORTANT THING ON SCREEN.
 *
 * An admin can tick "allow indexing" and still not be indexed,
 * because the page is thin. Without showing why, that reads as
 * a bug and someone eventually "fixes" it by removing the gate.
 *
 * So the verdict is shown live, with the reason, computed by
 * the SAME decideIndexable() the page and the sitemap call.
 * ---------------------------------------------------------------------------
 */

const TITLE_MAX = 60;
const DESC_MAX = 160;

export function SeoEditor({
  location,
  services,
  resolved,
}: {
  location: LocationRow;
  services: ServiceCategoryRow[];
  /** Resolved area flags, so the verdict matches what the site will do. */
  resolved: {
    isActive: boolean;
    isPublic: boolean;
    seoEnabled: boolean;
    comingSoon: boolean;
  };
}) {
  const [service, setService] = React.useState<string>("");
  const [draft, setDraft] = React.useState<SeoDraft>({ ...EMPTY_SEO });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");
  const [listings, setListings] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setSaved(false);
    setError("");
    const [row, n] = await Promise.all([
      getSeo(location.id, service || null).catch(() => null),
      getListingCount(location.id).catch(() => 0),
    ]);
    setDraft(row ?? { ...EMPTY_SEO });
    setListings(n);
    setLoading(false);
  }, [location.id, service]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof SeoDraft>(k: K, v: SeoDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };

  // Measured live from the unsaved draft, so the verdict updates as you type.
  const chars = contentLength({
    intro: draft.intro,
    body: draft.body,
    faq: draft.faq,
  });

  const verdict = decideIndexable({
    locationIsActive: resolved.isActive,
    locationIsPublic: resolved.isPublic,
    seoEnabled: resolved.seoEnabled,
    serviceAvailable: true,
    comingSoon: resolved.comingSoon,
    robotsIndex: draft.robots_index,
    listingCount: listings,
    contentChars: chars,
  });

  const save = async () => {
    setSaving(true);
    setError("");
    const r = await saveSeo(location.id, service || null, draft);
    if (!r.ok) setError(r.error || "Could not save.");
    else setSaved(true);
    setSaving(false);
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading SEO…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Which page am I editing? */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Page
        </label>
        <select
          value={service}
          onChange={(e) => setService(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium"
        >
          <option value="">
            Destination page — /destinations/{location.slug}
          </option>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name} in {location.name} — /destinations/{location.slug}/{s.slug}
            </option>
          ))}
        </select>
      </div>

      {/* Verdict */}
      <div
        className={cn(
          "flex gap-2 rounded-xl border p-3 text-sm",
          verdict.index
            ? "border-forest-600/40 bg-forest-50"
            : "border-gold/40 bg-gold/10"
        )}
      >
        {verdict.index ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
        ) : (
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
        )}
        <div>
          <p className="font-semibold text-forest">
            {verdict.index ? "This page will be indexed" : "This page will NOT be indexed"}
          </p>
          <p className="mt-0.5 text-muted-foreground">{verdict.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {listings} approved listing{listings === 1 ? "" : "s"} · {chars} characters
            of written content
          </p>
        </div>
      </div>

      {/* Snippet fields */}
      <Text
        label="SEO title"
        value={draft.seo_title}
        onChange={(v) => set("seo_title", v)}
        max={TITLE_MAX}
        hint="Shown as the blue link in search results. Longer titles get truncated."
      />
      <Area
        label="Meta description"
        value={draft.meta_description}
        onChange={(v) => set("meta_description", v)}
        max={DESC_MAX}
        rows={2}
        hint="Google often rewrites this, but a good one still raises click-through."
      />
      <Text
        label="Page heading (H1)"
        value={draft.h1}
        onChange={(v) => set("h1", v)}
        hint={`Leave blank to use "${service ? `${services.find((s) => s.slug === service)?.name ?? service} in ` : ""}${location.name}".`}
      />
      <Text
        label="Focus topic / keyword"
        value={draft.focus_keyword}
        onChange={(v) => set("focus_keyword", v)}
        hint="For your own tracking. Not written into the page."
      />

      {/* Content — the thing the gate actually measures */}
      <Area
        label="Introduction"
        value={draft.intro}
        onChange={(v) => set("intro", v)}
        rows={3}
        hint="One or two sentences under the heading."
      />
      <Area
        label="Destination content"
        value={draft.body}
        onChange={(v) => set("body", v)}
        rows={8}
        hint="Blank line between paragraphs. This is what earns the page a place in the index — write what a traveller genuinely needs to know, not keywords."
      />

      {/* FAQ */}
      <FaqEditor value={draft.faq} onChange={(v) => set("faq", v)} />

      {/* Images */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Text
          label="Hero image URL"
          value={draft.hero_image}
          onChange={(v) => set("hero_image", v)}
        />
        <Text
          label="Hero image alt text"
          value={draft.hero_image_alt}
          onChange={(v) => set("hero_image_alt", v)}
          hint="Describe the photo for screen readers. Not a keyword slot."
        />
      </div>

      {/* Social */}
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold text-forest">
          Social sharing &amp; canonical
        </summary>
        <div className="mt-3 space-y-3">
          <Text
            label="Open Graph title"
            value={draft.og_title}
            onChange={(v) => set("og_title", v)}
            hint="Falls back to the SEO title."
          />
          <Area
            label="Open Graph description"
            value={draft.og_description}
            onChange={(v) => set("og_description", v)}
            rows={2}
          />
          <Text
            label="Open Graph image URL"
            value={draft.og_image}
            onChange={(v) => set("og_image", v)}
          />
          <Text
            label="Canonical URL"
            value={draft.canonical_url}
            onChange={(v) => set("canonical_url", v)}
            hint="Leave blank unless you are deliberately pointing this page at another. Must be a path on this site."
          />
        </div>
      </details>

      {/* Robots */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle
          label="Allow indexing"
          checked={draft.robots_index}
          onChange={(v) => set("robots_index", v)}
          hint="Permission, not a guarantee — the page still has to pass the content check above."
        />
        <Toggle
          label="Follow links"
          checked={draft.robots_follow}
          onChange={(v) => set("robots_follow", v)}
          hint="Almost always leave this on."
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save SEO"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-medium text-forest-600">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FaqEditor({
  value,
  onChange,
}: {
  value: { q: string; a: string }[];
  onChange: (v: { q: string; a: string }[]) => void;
}) {
  const update = (i: number, patch: Partial<{ q: string; a: string }>) =>
    onChange(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-sm font-semibold text-forest">FAQ</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        These are shown on the page and emitted as FAQPage structured data. Both
        happen together — hidden FAQ markup is a manual-action risk, so there is
        no way to publish one without the other.
      </p>

      <div className="mt-3 space-y-3">
        {value.map((f, i) => (
          <div key={i} className="rounded-lg border border-border p-2">
            <div className="flex items-start gap-2">
              <input
                value={f.q}
                onChange={(e) => update(i, { q: e.target.value })}
                placeholder="Question"
                className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm font-medium"
              />
              <button
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="shrink-0 rounded p-1.5 text-red-600 hover:bg-red-50"
                aria-label="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={f.a}
              onChange={(e) => update(i, { a: e.target.value })}
              placeholder="Answer"
              rows={2}
              className="mt-2 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
            />
          </div>
        ))}
      </div>

      {value.length < 20 && (
        <button
          onClick={() => onChange([...value, { q: "", a: "" }])}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-forest hover:text-gold"
        >
          <Plus className="h-3.5 w-3.5" /> Add question
        </button>
      )}
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  hint,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  max?: number;
}) {
  const over = max != null && value.length > max;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        {max != null && (
          <span className={cn("text-xs", over ? "text-red-600" : "text-muted-foreground")}>
            {value.length}/{max}
          </span>
        )}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-lg border bg-card px-3 py-2 text-sm",
          over ? "border-red-400" : "border-border"
        )}
      />
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  hint,
  rows = 3,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  rows?: number;
  max?: number;
}) {
  const over = max != null && value.length > max;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        <span className={cn("text-xs", over ? "text-red-600" : "text-muted-foreground")}>
          {value.length}
          {max != null ? `/${max}` : ""}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={cn(
          "w-full rounded-lg border bg-card px-3 py-2 text-sm leading-relaxed",
          over ? "border-red-400" : "border-border"
        )}
      />
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-forest-600"
      />
      <span>
        <span className="block text-sm font-semibold text-forest">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
