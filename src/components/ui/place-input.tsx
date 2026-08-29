"use client";

import * as React from "react";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * A text box that suggests real places.
 *
 * THE PROBLEM IT FIXES IS NOT TYPING
 *   Every listing form asks for a location as free text with a
 *   placeholder like "e.g. Gilgit". So the database now holds
 *   Skardu, skardu, SKARDU and "Skardu, Gilgit-Baltistan" as
 *   four different strings. Filters compare strings, so a
 *   traveller filtering by Skardu does not see all of them —
 *   and nothing anywhere reports this. It looks like there are
 *   simply fewer listings than there are.
 *
 * SUGGESTIONS, NOT A DROPDOWN
 *   A closed <select> would be cleaner data and the wrong
 *   trade. Gilgit-Baltistan has villages this list has never
 *   heard of, and a provider whose valley is missing cannot
 *   list at all — a hard stop, to solve a soft problem. So:
 *   a datalist. The names are one keystroke away, and anything
 *   typed still saves.
 *
 * WHY <datalist> AND NOT A CUSTOM COMBOBOX
 *   It is the browser's own control: real keyboard behaviour,
 *   real screen-reader support, and on Android and iOS the
 *   native suggestion UI rather than a floating div that
 *   fights the on-screen keyboard. A hand-built one would be
 *   several hundred lines to be worse on a phone.
 *
 * Fails quiet. If the places cannot be loaded it is an ordinary
 * text input, which is exactly what it replaced.
 * ============================================================ */

/** Cached for the tab: every form on the page would otherwise fetch it. */
let cache: string[] | null = null;
let inFlight: Promise<string[]> | null = null;

async function loadPlaces(): Promise<string[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  if (!isSupabaseConfigured) return [];

  inFlight = (async () => {
    const names = new Set<string>();
    try {
      /* Both tables, because they hold different things: locations is the
         administrative tree (districts, cities, valleys), destinations is
         the smaller set travellers browse. A provider might reasonably type
         either. */
      const [loc, dest] = await Promise.all([
        supabase.from("locations").select("name").limit(500),
        supabase.from("destinations").select("name").limit(200),
      ]);
      for (const r of (loc.data ?? []) as { name?: string }[]) {
        if (r.name?.trim()) names.add(r.name.trim());
      }
      for (const r of (dest.data ?? []) as { name?: string }[]) {
        if (r.name?.trim()) names.add(r.name.trim());
      }
    } catch {
      /* Offline, or the tables are not there. An empty list means the input
         behaves exactly as it did before this existed. */
    }
    cache = [...names].sort((a, b) => a.localeCompare(b));
    inFlight = null;
    return cache;
  })();

  return inFlight;
}

export function PlaceInput({
  value,
  onChange,
  placeholder = "Start typing a place",
  className = "auth-input",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [places, setPlaces] = React.useState<string[]>(cache ?? []);
  const listId = React.useId();

  React.useEffect(() => {
    let alive = true;
    void loadPlaces().then((p) => {
      if (alive) setPlaces(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      <datalist id={listId}>
        {places.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </>
  );
}

/**
 * The same, for a field holding several places — "Skardu, Hunza, Gilgit".
 *
 * A datalist matches against the whole value, so on a comma-separated field
 * it stops suggesting after the first entry. This gives each place its own
 * removable chip instead, which also means the stored string is built by the
 * component rather than typed, so the separator is always the same.
 */
export function PlaceListInput({
  value,
  onChange,
  placeholder = "Add an area you serve",
}: {
  /** Comma-separated, as the column already stores it. */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const items = React.useMemo(
    () =>
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [value]
  );
  const [draft, setDraft] = React.useState("");

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    /* Case-insensitive, so "skardu" cannot be added next to "Skardu" — the
       duplication this component exists to stop. */
    if (items.some((i) => i.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...items, v].join(", "));
    setDraft("");
  };

  const remove = (i: number) =>
    onChange(items.filter((_, k) => k !== i).join(", "));

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {items.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="flex items-center gap-1 rounded-full bg-forest-50 py-1 pl-3 pr-1 text-sm text-forest"
            >
              {p}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${p}`}
                className="grid h-5 w-5 place-items-center rounded-full text-forest-600 hover:bg-forest-100"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <PlaceInput
        value={draft}
        onChange={setDraft}
        placeholder={placeholder}
        className="auth-input"
      />
      {draft.trim() && (
        <button
          type="button"
          onClick={() => add(draft)}
          className="mt-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-forest hover:bg-muted"
        >
          Add “{draft.trim()}”
        </button>
      )}
    </div>
  );
}

/**
 * Years for a vehicle, newest first.
 *
 * A free-text year gets "2022", "22", "2022 model" and "Model 2022" in the
 * same column. Thirty years back covers anything on the road here; a
 * provider with something older can still be listed, they just leave it
 * blank rather than type into a select.
 */
export function yearOptions(span = 30): string[] {
  const now = new Date().getFullYear();
  return Array.from({ length: span }, (_, i) => String(now - i));
}
