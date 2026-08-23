"use client";

import * as React from "react";

import { AreaPicker } from "@/components/dashboard/area-picker";

/* ============================================================
 * useAreaSelection — add an area to a listing form in 3 lines.
 *
 *   const area = useAreaSelection("hotels");
 *   ...
 *   {area.picker}                        // in the JSX
 *   ...
 *   const payload = { ...form, ...area.payload };
 *
 * ---------------------------------------------------------------------------
 * WHY A HOOK AND NOT A FIELD IN EACH FORM'S STATE
 *
 * Rego has twelve provider dashboards, several with three or four separate
 * forms inside them. Threading a new `location_id` through every form's
 * useState shape, its edit-populate branch and its reset would be forty-odd
 * hand edits across files that are working today, for one optional field.
 * The brief is explicit about not disturbing working modules, and every one
 * of those edits is a chance to break a provider's ability to list.
 *
 * So the hook owns the state. A form gains an area with three additive lines
 * and no change to anything it already does.
 * ---------------------------------------------------------------------------
 *
 * `payload` is an EMPTY OBJECT when nothing is selected — spreading it adds
 * no key at all, so a listing created before the market module was switched
 * on is written byte-for-byte as it is today.
 * ============================================================ */

export interface AreaSelection {
  /** Render this in the form, under the existing location field. */
  picker: React.ReactNode;
  /** Spread into the insert/update payload. `{}` when nothing is chosen. */
  payload: Record<string, string>;
  /** The raw id, for forms that need it directly. */
  locationId: string | null;
  /** Pre-select when opening an existing listing for editing. */
  setLocationId: (id: string | null) => void;
  /** Clear after a successful save. */
  reset: () => void;
}

export function useAreaSelection(
  serviceSlug: string,
  initial?: string | null
): AreaSelection {
  const [locationId, setLocationId] = React.useState<string | null>(initial ?? null);

  // Track the initial value so opening a different listing for editing
  // re-seeds the picker instead of keeping the previous one selected.
  const lastInitial = React.useRef(initial ?? null);
  React.useEffect(() => {
    if ((initial ?? null) !== lastInitial.current) {
      lastInitial.current = initial ?? null;
      setLocationId(initial ?? null);
    }
  }, [initial]);

  const picker = (
    <AreaPicker
      serviceSlug={serviceSlug}
      value={locationId}
      onChange={setLocationId}
      className="mt-3"
    />
  );

  return {
    picker,
    payload: locationId ? { location_id: locationId } : {},
    locationId,
    setLocationId,
    reset: () => setLocationId(null),
  };
}
