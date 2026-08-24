"use client";

import * as React from "react";
import { Loader2, MapPinPlus, X } from "lucide-react";

import {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  createLocation,
  slugify,
  suggestChildType,
  type LocationRow,
  type LocationType,
} from "@/lib/markets";

/* ============================================================
 * Add a location to the tree.
 *
 * ---------------------------------------------------------------------------
 * A NEW LOCATION IS CREATED CLOSED.
 *
 * Every control flag starts NULL — inheriting from the parent — and nothing
 * is made public, bookable or indexable by creating it. Adding a place to the
 * map is not the same as opening it for business, and conflating the two is
 * how an empty area ends up live with no listings in it.
 *
 * Turn it on afterwards, deliberately, in the Availability tab.
 * ---------------------------------------------------------------------------
 */

export function AddLocation({
  marketId,
  parent,
  onCreated,
}: {
  marketId: string;
  /** null = adding a top-level location in this market. */
  parent: LocationRow | null;
  onCreated: (id: string) => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [type, setType] = React.useState<LocationType>(
    suggestChildType(parent?.location_type ?? null)
  );
  const [lat, setLat] = React.useState("");
  const [lng, setLng] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  // Re-suggest the level when the selected parent changes.
  React.useEffect(() => {
    setType(suggestChildType(parent?.location_type ?? null));
  }, [parent?.location_type]);

  const reset = () => {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setLat("");
    setLng("");
    setError("");
    setOpen(false);
  };

  /* The slug follows the name until the admin edits it by hand, then stops —
     otherwise a deliberate slug is silently overwritten by a later typo in
     the name field. */
  const onName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    const r = await createLocation({
      marketId,
      parentId: parent?.id ?? null,
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      locationType: type,
      latitude: lat || null,
      longitude: lng || null,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error || "Could not create the location.");
      return;
    }
    reset();
    await onCreated((r as { id?: string }).id ?? "");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-forest-600 hover:text-forest"
      >
        <MapPinPlus className="h-3.5 w-3.5" />
        {parent ? `Add inside ${parent.name}` : "Add a top-level location"}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-forest-600/40 bg-forest-50/50 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-forest">
            {parent ? `New location in ${parent.name}` : "New top-level location"}
          </p>
          {parent && (
            <p className="text-[11px] text-muted-foreground">
              {(parent.path_slugs ?? []).join(" / ")}
            </p>
          )}
        </div>
        <button
          onClick={reset}
          className="rounded p-1 text-muted-foreground hover:text-forest"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="e.g. Hushe Valley"
            className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Slug
          </label>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="hushe-valley"
            className="w-full rounded border border-border bg-card px-2 py-1.5 font-mono text-xs"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Becomes part of the public URL. Lowercase letters, numbers and single
            hyphens. Changing it later needs a redirect, so get it right now.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Level
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LocationType)}
            className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
          >
            {LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {LOCATION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {parent && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Suggested from the parent ({parent.location_type}). Change it if
              your administrative structure differs.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Latitude
            </label>
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="35.2971"
              className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Longitude
            </label>
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="75.6333"
              className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs"
            />
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Optional. Used for structured data on the destination page — leave
          blank rather than guessing.
        </p>

        {error && (
          <p className="rounded bg-red-50 px-2 py-1.5 text-xs leading-relaxed text-red-700">
            {error}
          </p>
        )}

        <p className="rounded bg-muted/60 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Created hidden. It inherits every setting from its parent and will not
          appear on the website, accept listings or be indexed until you switch
          it on in <strong>Availability</strong>.
        </p>

        <button
          onClick={submit}
          disabled={busy || !name.trim() || !slug.trim()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-forest-600 px-3 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? "Creating…" : "Create location"}
        </button>
      </div>
    </div>
  );
}
