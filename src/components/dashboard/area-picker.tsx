"use client";

import * as React from "react";
import { Info, Loader2 } from "lucide-react";

import {
  getEnforcementConfig,
  getSubmittableAreas,
  type AreaOption,
  type EnforcementConfig,
} from "@/lib/area-rules";
import {
  buildLevels,
  deepestSelected,
  groupByType,
  levelLabel,
  orphanContext,
  pathAfterChange,
  selectionPath,
} from "@/lib/area-tree";

/* ============================================================
 * Area picker for provider listing forms.
 *
 * DESIGNED SO IT CANNOT BREAK AN EXISTING FORM.
 *
 * If the market module has not been switched on, or the areas
 * cannot be loaded, this renders NOTHING and the form behaves
 * exactly as it does today. Twelve provider dashboards depend
 * on those forms working; a location picker is not worth
 * risking one of them.
 *
 * It never replaces the existing free-text location field. That
 * field is what providers already understand and what every
 * listing card displays. This adds a structured area ALONGSIDE
 * it, which is what makes the change reversible.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOW SEVERAL DROPDOWNS AND NOT ONE
 *
 * It was one <select> listing every open area, indented by
 * depth with `" ".repeat(...)` inside the <option>. That
 * indentation never rendered: HTML collapses leading whitespace
 * in an option, so the hierarchy the code carefully computed was
 * invisible. A provider saw one flat alphabetical-ish list with
 * "Skardu" and "Shigar" and "Hunza" all looking like peers of
 * "Gilgit-Baltistan".
 *
 * Region → District → Area also matches how someone actually
 * knows where their guesthouse is, and it keeps each list short
 * enough to read on a phone.
 * ---------------------------------------------------------------------------
 * ============================================================ */

export function AreaPicker({
  serviceSlug,
  value,
  onChange,
  className,
  required: requiredByForm = false,
  onReady,
}: {
  /** Category slug, e.g. "hotels". Service-level rules use this. */
  serviceSlug: string;
  value: string | null;
  /**
   * The second argument is the chosen option itself. Optional, so the callers
   * that only want the id are unaffected — but a form that requires an area
   * needs to know WHICH level was chosen: "Pakistan" satisfies "something was
   * selected" and answers nothing.
   */
  onChange: (locationId: string | null, option?: AreaOption) => void;
  className?: string;
  /**
   * The form insists on an area, regardless of the admin-wide setting.
   *
   * There are two separate reasons an area can be mandatory and they were not
   * both represented: market_enforcement.require_location_id is a global
   * decision an admin makes, and this is one form deciding for itself. Only
   * the first existed, so a wizard could block on a missing area while the
   * label beside it read "(optional)" — the form contradicting itself, which
   * is worse than either answer.
   */
  required?: boolean;
  /**
   * Fires with how many top-level options loaded, so a form can require the
   * area ONLY when there is one to choose. Without this, "compulsory" would
   * block registration entirely on any day the areas fail to load — and this
   * component's whole design is that it disappears rather than breaks.
   */
  onReady?: (optionCount: number) => void;
}) {
  const [areas, setAreas] = React.useState<AreaOption[]>([]);
  const [cfg, setCfg] = React.useState<EnforcementConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, a] = await Promise.all([
          getEnforcementConfig(),
          getSubmittableAreas(serviceSlug),
        ]);
        if (!alive) return;
        setCfg(c);
        setAreas(a);
      } catch {
        /* Silent. A picker that cannot load must not become an error message
           on a form the provider was using perfectly well yesterday. */
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [serviceSlug]);

  /* The dropdowns are driven by a path, not by `value`, because a chain of
     selects holds more state than one id can carry: "Skardu district, no area
     chosen yet" and "nothing chosen" report the same deepest id if the path is
     forgotten. Seeded from `value` so opening a listing for editing sets every
     level above the saved area, and re-seeded if the parent form swaps
     listings underneath us. */
  const [path, setPath] = React.useState<string[]>([]);
  const seeded = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (areas.length === 0) return;
    if (seeded.current === (value ?? null)) return;
    seeded.current = value ?? null;
    setPath(selectionPath(areas, value ?? null));
  }, [areas, value]);

  /* Reported after render decisions are made, so it reflects what the provider
     can actually see rather than what was fetched. */
  const readyRef = React.useRef(-1);
  React.useEffect(() => {
    if (loading) return;
    const count = failed || !cfg ? 0 : buildLevels(areas, []).length === 0 ? 0 : areas.length;
    if (readyRef.current === count) return;
    readyRef.current = count;
    onReady?.(count);
  }, [loading, failed, cfg, areas, onReady]);

  const choose = (levelIndex: number, id: string | null) => {
    const next = pathAfterChange(path, levelIndex, id);
    setPath(next);
    const deepest = deepestSelected(next);
    onChange(deepest, areas.find((a) => a.id === deepest));
  };

  // Nothing set up yet, or something went wrong -> render nothing at all.
  if (loading || failed || !cfg) return null;
  if (areas.length === 0) return null;

  const required = requiredByForm || cfg.requireLocationId;
  const levels = buildLevels(areas, path);
  if (levels.length === 0) return null;

  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-foreground">
        Area
        {required ? (
          <span className="text-red-600"> *</span>
        ) : (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        {levels.map((level, i) => (
          <select
            key={i}
            value={level.selected ?? ""}
            onChange={(e) => choose(i, e.target.value || null)}
            /* Only the first level carries `required`. Requiring every level
               would demand a village from a provider whose district simply has
               none listed under it. */
            required={required && i === 0}
            aria-label={levelLabel(level.options)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">
              {i === 0 && required
                ? `Choose a ${levelLabel(level.options).toLowerCase()}`
                : `${levelLabel(level.options)} \u2014 not specified`}
            </option>
            {(() => {
              /* An area whose parent is closed appears here rather than under
                 that parent. Saying where it is stops "Kachura" being a
                 guess. */
              const opt = (a: AreaOption) => {
                const where = orphanContext(a, areas);
                return (
                  <option key={a.id} value={a.id}>
                    {where ? `${a.name} \u2014 in ${where}` : a.name}
                  </option>
                );
              };

              /* Empty unless this level holds more than one kind of place,
                 which only happens when something is mis-parented. Then a
                 division and a district are not peers and should not read as
                 peers — so they get headings instead of being hidden. */
              const groups = groupByType(level.options);
              if (groups.length === 0) return level.options.map(opt);

              return groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map(opt)}
                </optgroup>
              ));
            })()}
          </select>
        ))}
      </div>

      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Only areas currently open to new {serviceSlug.replace(/-/g, " ")}{" "}
          listings are shown. Stop at whatever level you are sure of &mdash; your
          written location above is unchanged either way.
        </span>
      </p>
    </div>
  );
}

/** Small inline spinner for forms that want to show the picker loading. */
export function AreaPickerSkeleton() {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Loading areas…
    </p>
  );
}
