"use client";

import * as React from "react";
import {
  Camera, Plus, Trash2, Save, Sparkles, ChevronDown, ChevronUp, Loader2,
  ArrowUp, ArrowDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  ATTRACTION_TYPES, parseAttractions, suggestedFor, type Attraction,
} from "@/lib/attractions";
import { updateDestinationAttractions, type DestinationRow } from "@/lib/destinations";
import { cn } from "@/lib/utils";

const BLANK: Attraction = { name: "", type: "", blurb: "", image: "" };

/** Add, edit and reorder the tourist spots shown on one destination page. */
export function AttractionsEditor({ row }: { row: DestinationRow }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Attraction[]>(() =>
    parseAttractions(row.attractions)
  );
  const [saving, setSaving] = React.useState(false);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  const presets = React.useMemo(
    () => suggestedFor(row.slug, row.name),
    [row.slug, row.name]
  );

  const patch = (i: number, k: keyof Attraction, v: string) =>
    setItems((p) => p.map((a, j) => (j === i ? { ...a, [k]: v } : a)));

  const move = (i: number, dir: -1 | 1) =>
    setItems((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const loadPresets = () => {
    // Keep anything already added; only append spots that aren't there yet.
    const have = new Set(items.map((a) => a.name.trim().toLowerCase()));
    const add = presets.filter((p) => !have.has(p.name.toLowerCase()));
    setItems((p) => [...p, ...add]);
    setNote(
      add.length
        ? { ok: true, text: `Added ${add.length} suggested spot${add.length === 1 ? "" : "s"}. Add photos, then save.` }
        : { ok: true, text: "All suggested spots are already in the list." }
    );
  };

  const save = async () => {
    setNote(null);
    const clean = items
      .map((a) => ({
        name: a.name.trim(),
        type: a.type.trim(),
        blurb: a.blurb.trim(),
        image: a.image.trim(),
      }))
      .filter((a) => a.name);

    setSaving(true);
    const { error } = await updateDestinationAttractions(row.id, clean);
    setSaving(false);

    if (error) {
      setNote({
        ok: false,
        text:
          error.message.includes("attractions") || error.message.includes("column")
            ? "Run supabase/phase65-destination-attractions.sql first — the attractions column is missing."
            : error.message,
      });
      return;
    }
    setItems(clean);
    setNote({ ok: true, text: `Saved ${clean.length} attraction${clean.length === 1 ? "" : "s"}.` });
  };

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-forest-700 hover:bg-muted/60"
      >
        <span className="inline-flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5 text-gold" />
          Attractions
          <span className="rounded-full bg-forest-50 px-1.5 py-0.5 text-[11px] font-bold text-forest-700">
            {items.length}
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-3 bg-muted/30 p-3">
          {note && (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium",
                note.ok
                  ? "bg-forest-50 text-forest-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              )}
            >
              {note.text}
            </p>
          )}

          {presets.length > 0 && (
            <button
              type="button"
              onClick={loadPresets}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/50 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-forest hover:bg-gold/20"
            >
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Load {presets.length} suggested spots for {row.name}
            </button>
          )}

          {items.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-card px-3 py-6 text-center text-xs text-muted-foreground">
              No attractions yet. Add them one by one, or load the suggested list.
            </p>
          )}

          {items.map((a, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest-50 text-[11px] font-bold text-forest-700">
                  {i + 1}
                </span>
                <input
                  value={a.name}
                  onChange={(e) => patch(i, "name", e.target.value)}
                  placeholder="Spot name, e.g. Attabad Lake"
                  className="auth-input flex-1"
                />
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    aria-label="Move up"
                    className="grid h-5 w-6 place-items-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}
                    aria-label="Move down"
                    className="grid h-5 w-6 place-items-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setItems((p) => p.filter((_, j) => j !== i))}
                  aria-label={`Remove ${a.name || "attraction"}`}
                  className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                <input
                  value={a.type}
                  onChange={(e) => patch(i, "type", e.target.value)}
                  list="rego-attraction-types"
                  placeholder="Type"
                  className="auth-input"
                />
                <input
                  value={a.blurb}
                  onChange={(e) => patch(i, "blurb", e.target.value)}
                  placeholder="One line about why it's worth seeing"
                  className="auth-input"
                />
              </div>

              <div>
                <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                  Photo (optional — uses the destination cover when empty)
                </span>
                <ImageUpload value={a.image} onChange={(url) => patch(i, "image", url)} />
              </div>
            </div>
          ))}

          <datalist id="rego-attraction-types">
            {ATTRACTION_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setItems((p) => [...p, { ...BLANK }])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-forest hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Add attraction
            </button>
            <Button
              type="button" variant="gold" size="sm" disabled={saving}
              onClick={save} className="rounded-lg"
            >
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              ) : (
                <><Save className="h-3.5 w-3.5" /> Save attractions</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
