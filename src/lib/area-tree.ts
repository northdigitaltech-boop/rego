import type { AreaOption } from "@/lib/area-rules";

/* ============================================================
 * Turning the flat list of open areas into cascading dropdowns.
 *
 * WHY THIS IS NOT markets.ts's childrenOf()
 *   That one walks the ADMIN tree, where every location is
 *   present. This one walks the PROVIDER tree, which is the
 *   admin tree with the closed parts removed — and removing
 *   parts of a tree is what makes it interesting.
 *
 * THE PROBLEM THAT SHAPES THIS FILE
 *   getSubmittableAreas returns only areas open to new listings.
 *   Openness is inherited but overridable, so a district can be
 *   closed while one area inside it stays open. That area then
 *   arrives with a parent_id pointing at a row that is not in
 *   the list at all.
 *
 *   Grouping by `depth` would put such an area on the district
 *   row and orphan it. So the levels are built by following
 *   parent links and treating "my parent is not here" as "I am
 *   a root" — the area still appears, one level up, instead of
 *   silently vanishing from a form.
 * ============================================================ */

/**
 * The areas that start a chain: no parent, or a parent that was filtered out.
 *
 * The second case is the whole point — see the note above.
 */
export function visibleRoots(areas: AreaOption[]): AreaOption[] {
  const present = new Set(areas.map((a) => a.id));
  return areas.filter((a) => !a.parent_id || !present.has(a.parent_id));
}

/** Open areas directly under `parentId`. */
export function childrenOfArea(areas: AreaOption[], parentId: string): AreaOption[] {
  return areas.filter((a) => a.parent_id === parentId);
}

/**
 * The chain of ids from a visible root down to `selectedId`.
 *
 * Used when a provider opens an existing listing for editing: the form knows
 * one id, and every dropdown above it has to be set to match. Returns [] if
 * the id is not in the open set — a listing saved when an area was open and
 * opened again after it closed, which must not throw.
 */
export function selectionPath(areas: AreaOption[], selectedId: string | null): string[] {
  if (!selectedId) return [];
  const byId = new Map(areas.map((a) => [a.id, a]));
  if (!byId.has(selectedId)) return [];

  const path: string[] = [];
  let cursor: string | null = selectedId;
  /* Bounded by the number of areas: the database trigger rejects cycles, but
     a loop that trusts data it did not create is a loop that can hang a form. */
  for (let guard = 0; cursor && guard <= areas.length; guard++) {
    path.unshift(cursor);
    const parent: string | null = byId.get(cursor)?.parent_id ?? null;
    cursor = parent && byId.has(parent) ? parent : null;
  }
  return path;
}

export interface AreaLevel {
  /** What this dropdown offers. Never empty — a level with no options is not built. */
  options: AreaOption[];
  /** The id chosen at this level, or null while the provider has not chosen. */
  selected: string | null;
}

/**
 * One entry per dropdown to render, outermost first.
 *
 * A level appears only when the choice above it has children, so a provider in
 * a district with no areas below it sees two dropdowns, not two and an empty
 * third. The last level is where the answer comes from.
 */
export function buildLevels(areas: AreaOption[], path: string[]): AreaLevel[] {
  const roots = visibleRoots(areas);
  if (roots.length === 0) return [];

  const levels: AreaLevel[] = [{ options: roots, selected: path[0] ?? null }];

  for (let i = 0; i < path.length; i++) {
    const kids = childrenOfArea(areas, path[i]);
    if (kids.length === 0) break;
    levels.push({ options: kids, selected: path[i + 1] ?? null });
  }
  return levels;
}

/**
 * The path after choosing `id` at `levelIndex`.
 *
 * Everything below is dropped, which is what "reset child selections when the
 * parent changes" means in practice: choosing a different district must not
 * leave the previous district's village sitting underneath it. Clearing a
 * level (id === null) truncates there.
 */
export function pathAfterChange(path: string[], levelIndex: number, id: string | null): string[] {
  const next = path.slice(0, levelIndex);
  if (id) next.push(id);
  return next;
}

/**
 * What gets saved as location_id: the deepest choice made.
 *
 * A provider who picks a district and stops has told us something true, so the
 * district is saved rather than nothing. Precision is welcome, not required.
 */
export function deepestSelected(path: string[]): string | null {
  return path.length > 0 ? path[path.length - 1] : null;
}

/**
 * Where an orphaned option actually is, for the dropdown label.
 *
 * An area whose parent is closed is shown at the top level (see the note at
 * the head of this file). On its own that reads as though the area has no
 * parent, and "Kachura" alone is not enough to pick between two places with
 * similar names — or to be confident it is the right one at all.
 *
 * Returns the name of the parent it would have been nested under, taken from
 * path_slugs, which is maintained by the database trigger. Slugs are all we
 * have here — `getSubmittableAreas` does not fetch ancestor names — so
 * "baltistan-division" becomes "Baltistan Division". That is a display guess
 * about capitalisation only, never about which place it is.
 *
 * null when the option is a genuine root, or when there is nothing to add.
 */
export function orphanContext(a: AreaOption, areas: AreaOption[]): string | null {
  if (!a.parent_id) return null;
  if (areas.some((x) => x.id === a.parent_id)) return null;

  const parts = a.path.split(" / ").filter(Boolean);
  // Last part is this location itself; the one before it is its parent.
  const parent = parts.length >= 2 ? parts[parts.length - 2] : null;
  if (!parent) return null;

  return parent
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Label for a level, from the kind of place it offers.
 *
 * Read off the data rather than assumed from position, because the tree is not
 * uniform: Gilgit-Baltistan has divisions between region and district, and a
 * country entered later may not. A level holding a mix falls back to "Area".
 */
export function levelLabel(options: AreaOption[]): string {
  const types = new Set(options.map((o) => o.location_type));
  if (types.size !== 1) return "Area";
  switch ([...types][0]) {
    case "country":  return "Country";
    case "region":   return "Region / Province";
    case "division": return "Division";
    case "district": return "District";
    case "city":     return "City / Town";
    case "area":     return "Area";
    default:         return "Area";
  }
}
