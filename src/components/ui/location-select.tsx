"use client";

import * as React from "react";

import { PlaceInput } from "@/components/ui/place-input";
import {
  districtsOf,
  findByName,
  loadPlaceTree,
  placesOf,
  regionOfDistrict,
  regionsOf,
  type PlaceNode,
} from "@/lib/place-tree";

/* ============================================================
 * Region → District → City / Area, chosen from the places Rego
 * already knows about.
 *
 * WHAT THIS REPLACES
 *   Empty text boxes. The map pin form asked for a district and
 *   a city as free text, so the same district arrives as Skardu,
 *   skardu, SKARDU and "Skardu District" — and the map filters
 *   by string, so a traveller filtering to Skardu sees some of
 *   the pins and no warning that the rest exist.
 *
 * ---------------------------------------------------------------------------
 * WHY A SELECT HERE AND A SUGGESTING TEXT BOX ON PROVIDER FORMS
 *
 * PlaceInput deliberately stays open-ended: a provider whose
 * valley is missing from the tree must still be able to list,
 * and a closed dropdown would stop them dead to solve a tidiness
 * problem.
 *
 * An admin is on the other side of that trade. If a district is
 * missing they can add it in Market & Area Management, which is
 * two clicks away — so a closed list costs them nothing and buys
 * a column that filters correctly.
 * ---------------------------------------------------------------------------
 *
 * IT STILL CANNOT BLOCK THE FORM
 *   If the tree comes back empty — the module is not set up, the
 *   read is refused, the browser is offline — this renders the
 *   suggesting text box instead of three dropdowns with nothing
 *   in them. An admin staring at an empty Region dropdown with
 *   no way past it is the bug this is supposed to prevent, not
 *   cause. (That failure has happened here before: the marketing
 *   team could not add destinations for exactly this reason, and
 *   the cause was a read policy, not the form.)
 *
 * A VALUE THAT IS NOT IN THE TREE IS KEPT, NOT DROPPED
 *   Pins saved before this existed hold names that may no longer
 *   match anything. Those appear as an option of their own,
 *   marked, so opening an old pin and saving it does not quietly
 *   erase where it is.
 * ============================================================ */

export interface PlaceValue {
  region: string;
  district: string;
  place: string;
}

/** One <select>, styled like every other field on these forms. */
function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  disabledHint,
}: {
  label: string;
  value: string;
  options: PlaceNode[];
  onChange: (name: string) => void;
  placeholder: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  /* A saved name the tree no longer has. Shown rather than reset — see the
     note at the head of this file. */
  const unknown =
    value.trim() && !findByName(options, value) ? value.trim() : null;

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <select
        className="auth-input"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{disabled && disabledHint ? disabledHint : placeholder}</option>
        {unknown && <option value={unknown}>{unknown} — not in the list</option>}
        {options.map((o) => (
          <option key={o.id} value={o.name}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The three-level picker.
 *
 * Reports names, because that is what these columns store.
 */
export function RegionDistrictPlace({
  value,
  onChange,
  placeLabel = "City / Area",
}: {
  value: PlaceValue;
  onChange: (v: PlaceValue) => void;
  /** Some forms call the third level something else. */
  placeLabel?: string;
}) {
  const [tree, setTree] = React.useState<PlaceNode[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    void loadPlaceTree().then((t) => {
      if (!alive) return;
      setTree(t);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const regions = React.useMemo(() => regionsOf(tree), [tree]);
  const regionNode = React.useMemo(
    () => findByName(regions, value.region),
    [regions, value.region]
  );
  const districts = React.useMemo(
    () => districtsOf(tree, regionNode?.id ?? null),
    [tree, regionNode]
  );
  const districtNode = React.useMemo(
    () => findByName(districts, value.district),
    [districts, value.district]
  );
  const places = React.useMemo(
    () => placesOf(tree, districtNode?.id ?? null),
    [tree, districtNode]
  );

  /* An existing pin holds a district and no region — every pin created before
     this picker did. Fill the region in from the tree once, so the dropdowns
     agree with each other instead of showing a district under a blank region.
     Runs only when the region is genuinely empty, so it can never overwrite a
     choice someone made. */
  const backfilled = React.useRef(false);
  React.useEffect(() => {
    if (backfilled.current || loading || tree.length === 0) return;
    if (value.region.trim() || !value.district.trim()) return;

    const d = findByName(districtsOf(tree, null), value.district);
    const r = regionOfDistrict(tree, d?.id ?? null);
    backfilled.current = true;
    if (r) onChange({ ...value, region: r.name });
  }, [loading, tree, value, onChange]);

  /* Nothing to choose from. Rather than three dead dropdowns, fall back to the
     suggesting text boxes the rest of the site uses — the form keeps working
     and whatever is typed still saves. */
  if (!loading && regions.length === 0) {
    return (
      <>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            District
          </span>
          <PlaceInput
            value={value.district}
            onChange={(v) => onChange({ ...value, district: v })}
            placeholder="Start typing a district"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            {placeLabel}
          </span>
          <PlaceInput
            value={value.place}
            onChange={(v) => onChange({ ...value, place: v })}
          />
        </label>
      </>
    );
  }

  return (
    <>
      <Select
        label="Region"
        value={value.region}
        options={regions}
        placeholder={loading ? "Loading…" : "Choose a region"}
        /* Changing the region drops the district and place beneath it. Keeping
           them would leave a Skardu district sitting under a region it is not
           in, which reads as correct and is not. */
        onChange={(region) => onChange({ region, district: "", place: "" })}
      />
      <Select
        label="District"
        value={value.district}
        options={districts}
        placeholder="Choose a district"
        onChange={(district) => onChange({ ...value, district, place: "" })}
      />
      <Select
        label={placeLabel}
        value={value.place}
        options={places}
        placeholder={places.length === 0 ? "Nothing listed under this district" : "Choose a place"}
        disabled={!value.district.trim()}
        disabledHint="Choose a district first"
        onChange={(place) => onChange({ ...value, place })}
      />
    </>
  );
}

/**
 * Just the districts, for a form that already asked for one.
 *
 * WHY THIS EXISTS SEPARATELY
 *   The job form had a closed district dropdown built from a hardcoded array
 *   in jobs.ts — a second list of the province's districts, maintained by
 *   hand, drifting from the locations table every time an admin edits one.
 *   Two lists of the same thing is one list and a bug waiting for a rename.
 *
 *   The free-text city field beside it is deliberately left alone: a provider
 *   posting a job in a village the tree has never heard of must still be able
 *   to post it, and that trade is the same one PlaceInput makes.
 */
export function DistrictSelect({
  value,
  onChange,
  includeOther = true,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Keeps the escape hatch the hardcoded list had. */
  includeOther?: boolean;
}) {
  const [tree, setTree] = React.useState<PlaceNode[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    void loadPlaceTree().then((t) => {
      if (!alive) return;
      setTree(t);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const districts = React.useMemo(() => districtsOf(tree, null), [tree]);
  const unknown = value.trim() && !findByName(districts, value) ? value.trim() : null;

  return (
    <select className="auth-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{loading ? "Loading…" : "Choose…"}</option>
      {unknown && unknown !== "Other" && <option value={unknown}>{unknown}</option>}
      {districts.map((d) => (
        <option key={d.id} value={d.name}>
          {d.name}
        </option>
      ))}
      {includeOther && <option value="Other">Other</option>}
    </select>
  );
}

/**
 * One dropdown of every real place, for fields that hold a single location
 * with no hierarchy around it — a road's start and end, an alert's location,
 * the two ends of a distance.
 *
 * Flat rather than cascading because these are read as one value ("Gilgit →
 * Skardu"), and making someone pick a region to name the end of a road would
 * be three clicks to answer a one-click question.
 */
export function PlaceSelect({
  label,
  value,
  onChange,
  placeholder = "Choose a place",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [tree, setTree] = React.useState<PlaceNode[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    void loadPlaceTree().then((t) => {
      if (!alive) return;
      setTree(t);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* Districts and everything below them, in one list. Regions and divisions
     are left out: "Gilgit-Baltistan" is not one end of a road. */
  const options = React.useMemo(() => {
    const districts = districtsOf(tree, null);
    const rest = districts.flatMap((d) => placesOf(tree, d.id));
    const seen = new Set<string>();
    return [...districts, ...rest]
      .filter((n) => {
        const key = n.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tree]);

  if (!loading && options.length === 0) {
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">
          {label}
        </span>
        <PlaceInput value={value} onChange={onChange} />
      </label>
    );
  }

  return (
    <Select
      label={label}
      value={value}
      options={options}
      placeholder={loading ? "Loading…" : placeholder}
      onChange={onChange}
    />
  );
}
