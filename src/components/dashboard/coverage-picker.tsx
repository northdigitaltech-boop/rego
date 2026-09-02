"use client";

import * as React from "react";
import { Info, MapPin, X } from "lucide-react";

import { getSubmittableAreas, type AreaOption } from "@/lib/area-rules";
import { orphanContext } from "@/lib/area-tree";
import { cn } from "@/lib/utils";

/* ============================================================
 * Where a provider WORKS, as opposed to where they ARE.
 *
 * An Islamabad tour company picks Islamabad in the Area field
 * above this one, and Skardu, Hunza and Gilgit in this one.
 *
 * SAME SAFETY RULE AS AreaPicker
 *   Renders nothing if the areas cannot be loaded. Twelve
 *   provider dashboards depend on these forms working, and a
 *   coverage field is not worth risking one of them.
 *
 * WHY CHECKBOXES AND NOT A SECOND CASCADE
 *   The single Area field is one answer, so a chain of dropdowns
 *   narrows it well. This is "everywhere you work", which is a
 *   set — and a cascade makes picking Skardu, Hunza and Gilgit
 *   take nine interactions instead of three. Grouped checkboxes
 *   with a filter box stay readable on a phone and let someone
 *   tick four districts without navigating anywhere.
 * ============================================================ */

export function CoveragePicker({
  serviceSlug,
  value,
  onChange,
  className,
  label = "Where do you provide your services?",
  hint,
}: {
  /** Category slug, e.g. "travel-companies". Decides which areas are open. */
  serviceSlug: string;
  /** Selected location ids. */
  value: string[];
  /**
   * Ids for the relational table, names for the existing free-text
   * `service_areas` column. Both, because the text column is what every
   * listing card renders today and dropping it would blank them all.
   */
  onChange: (locationIds: string[], names: string[]) => void;
  className?: string;
  label?: string;
  hint?: string;
}) {
  const [areas, setAreas] = React.useState<AreaOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [filter, setFilter] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await getSubmittableAreas(serviceSlug);
        if (alive) setAreas(a);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [serviceSlug]);

  const selected = React.useMemo(() => new Set(value), [value]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const ids = [...next];
    /* Names in the same order as ids, read from the loaded areas rather than
       remembered separately — one source, so they cannot drift apart. */
    const byId = new Map(areas.map((a) => [a.id, a.name]));
    onChange(ids, ids.map((i) => byId.get(i) ?? "").filter(Boolean));
  };

  /* Only the levels worth ticking. Offering "Gilgit-Baltistan" alongside
     "Skardu" invites someone to tick the region and mean the district, and
     then a search for Skardu does not find them. Districts and below are
     specific enough to be a real answer. */
  const selectable = React.useMemo(
    () =>
      areas.filter((a) =>
        ["district", "city", "area", "village", "attraction", "landmark"].includes(
          a.location_type
        )
      ),
    [areas]
  );

  const shown = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return selectable;
    return selectable.filter((a) => a.name.toLowerCase().includes(q));
  }, [selectable, filter]);

  if (loading || failed) return null;
  if (selectable.length === 0) return null;

  /* Chosen areas are listed separately as well as ticked, because a provider
     who has filtered the list down cannot otherwise see what they picked
     three searches ago. */
  const chosen = selectable.filter((a) => selected.has(a.id));

  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {label}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          (optional)
        </span>
      </label>

      {chosen.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chosen.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-600 hover:bg-forest-100"
            >
              <MapPin className="h-3 w-3" />
              {a.name}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {selectable.length > 8 && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search areas…"
          className="mb-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      )}

      <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-1">
        {shown.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No areas match “{filter}”.
          </p>
        ) : (
          shown.map((a) => {
            const where = orphanContext(a, areas);
            const on = selected.has(a.id);
            return (
              <label
                key={a.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  on ? "bg-forest-50 text-forest-600" : "hover:bg-muted/60"
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(a.id)}
                  className="h-4 w-4 rounded border-border accent-forest-600"
                />
                <span className="min-w-0 flex-1 truncate">
                  {a.name}
                  {where && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      in {where}
                    </span>
                  )}
                </span>
              </label>
            );
          })
        )}
      </div>

      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          {hint ??
            "Tick everywhere you work, not just where you are based. This is what travellers filter by, so a company in Islamabad that runs Skardu tours should tick Skardu."}
        </span>
      </p>
    </div>
  );
}
