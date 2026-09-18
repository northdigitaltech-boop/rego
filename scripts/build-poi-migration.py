#!/usr/bin/env python3
"""Turn the Baltistan POI spreadsheet into a Rego Map migration.

    pip install openpyxl
    python scripts/build-poi-migration.py \
        supabase/data/REGO_Baltistan_Tourist_POIs.xlsx \
        supabase/phase128-baltistan-tourist-pois.sql

WHY A GENERATOR AND NOT NINETY HAND-TYPED ROWS
    Ninety rows copied by hand is ninety chances to move a decimal point,
    and a coordinate typo on a map is invisible until somebody drives to it.
    This reads the sheet, so the migration says exactly what the sheet says.
    When the sheet is updated, re-run it — the output is regenerated, not
    patched.

THE PUBLISHING RULES COME FROM THE SHEET'S OWN README, NOT FROM ME
    A / A2  official GB Tourism or GB government coordinate
              -> published, marked verified
    B       exact mapped feature with a traceable public reference
              -> published, NOT marked verified
    C       useful location, "field-check the preferred REGO pin before
            marking as fully verified"
              -> published, NOT marked verified, and the pending field-check
                 is written into `source` so it is visible in the admin
    D       "Do not publish as an exact navigation pin yet"
              -> NOT published, and coordinates dropped even if present

    The sheet also says: "Blank coordinates are intentional ... Do not
    substitute guessed coordinates." Nothing here invents one.
"""

import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover
    sys.exit("pip install openpyxl")

# Spreadsheet category -> Rego Map category slug.
# Ordered: the first prefix that matches wins, so "Mountain Pass / Trekking"
# is a pass rather than being caught by the "Mountain" rule below it.
CATEGORY_RULES: list[tuple[str, str]] = [
    ("National Park", "parks"),
    ("Lake", "lakes"),
    ("Waterfall", "waterfalls"),
    ("Cold Desert", "deserts"),
    ("Glacier", "glaciers"),
    ("Mountain Pass", "passes"),
    ("Mountain", "peaks"),
    ("Trekking Camp", "base-camps"),
    ("Trekking /", "viewpoints"),
    ("Archaeological", "heritage"),
    ("Historical / Religious", "mosques"),
    ("Fort /", "forts"),
    ("Palace /", "forts"),
    ("Bridge /", "viewpoints"),
    ("Viewpoint", "viewpoints"),
    ("Valley", "valleys"),
    ("Meadow", "valleys"),
    ("Scenic Village", "villages"),
    ("Cultural Village", "villages"),
    ("Adventure Gateway", "villages"),
    ("Scenic / Camping", "camping"),
    ("Stream", "rivers"),
    ("Forest", "parks"),
    ("Agritourism", "tourist-spots"),
]

FALLBACK = "tourist-spots"


def slug_for(raw: str) -> str:
    text = (raw or "").strip()
    for prefix, slug in CATEGORY_RULES:
        if text.startswith(prefix):
            return slug
    return FALLBACK


def q(value) -> str:
    """A SQL literal. None becomes NULL; quotes are doubled."""
    if value is None:
        return "null"
    text = str(value).strip()
    if not text:
        return "null"
    return "'" + text.replace("'", "''") + "'"


def num(value) -> str:
    if value is None or value == "":
        return "null"
    return repr(float(value))


def main() -> None:
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])

    rows = [
        r
        for r in openpyxl.load_workbook(src)["Tourist_POIs"].iter_rows(
            min_row=2, values_only=True
        )
        if r[0]
    ]

    values, unmapped, counts = [], set(), {"A": 0, "B": 0, "C": 0, "D": 0}

    for name, category, district, city, lat, lng, desc, source, status in rows:
        grade = str(status or "").strip()[:1].upper() or "C"
        counts[grade] = counts.get(grade, 0) + 1

        if not any((category or "").strip().startswith(p) for p, _ in CATEGORY_RULES):
            unmapped.add(category)

        verified = grade == "A"
        published = grade != "D"

        # Grade D is "do not publish as an exact navigation pin yet", so its
        # coordinates are dropped rather than carried on a hidden row where a
        # later Publish would quietly make them live.
        lat_out = "null" if grade == "D" else num(lat)
        lng_out = "null" if grade == "D" else num(lng)

        note = f"{status} | {source}" if source else str(status)
        if grade == "C":
            note = "FIELD-CHECK PENDING — " + note
        if grade == "D":
            note = "PIN NOT VERIFIED — " + note

        values.append(
            "  ("
            + ", ".join(
                [
                    q(name),
                    q(slug_for(category)),
                    q(district),
                    q(city),
                    lat_out,
                    lng_out,
                    q(desc),
                    q(note),
                    "true" if verified else "false",
                    "true" if published else "false",
                    q(category),
                ]
            )
            + ")"
        )

    if unmapped:
        print("Unmapped categories (they fall back to tourist-spots):")
        for c in sorted(unmapped):
            print("   ", c)

    out.write_text(TEMPLATE.format(
        count=len(rows),
        source_name=src.name,
        grades=", ".join(f"{k}={v}" for k, v in sorted(counts.items()) if v),
        values=",\n".join(values),
    ), encoding="utf-8")

    print(f"Wrote {out} — {len(rows)} places ({', '.join(f'{k}={v}' for k, v in sorted(counts.items()) if v)})")


TEMPLATE = """-- ============================================================
-- phase128 — Baltistan tourist POIs, from the sourced dataset.
--
-- GENERATED by scripts/build-poi-migration.py from
-- supabase/data/{source_name}. Do not hand-edit:
-- change the spreadsheet and regenerate, or the file and the
-- data it claims to come from stop agreeing.
--
-- {count} places across Skardu, Shigar, Ghanche, Kharmang and
-- Roundu. Verification grades: {grades}.
--
-- REQUIRES phase122 (region) and phase124 (optional coordinates).
--
-- ---------------------------------------------------------------------------
-- IT REPLACES THE PLACEHOLDER ROWS FROM phase125 AND phase126
--
-- Those two recorded names with no coordinates, waiting for
-- exactly this. Most of them are in here again with a real
-- position and a source — but spelled differently: "Basho Valley
-- (Basho Meadows)" against "Basho Valley & Meadows", "Kharphocho
-- Fort" against "Kharpocho Fort (Skardu Fort)". Name matching
-- would miss those and leave the map showing each place twice,
-- once findable and once not.
--
-- So the placeholders are deleted first — but only the ones
-- nobody has touched: still unpublished, still unverified, still
-- without coordinates, still carrying PIN NOT VERIFIED. A pin
-- somebody has since located and published is not deleted by
-- this. Skipping phase125 and phase126 entirely is also fine;
-- the delete simply finds nothing.
--
-- WHAT DECIDES WHETHER A PLACE GOES LIVE
--   Taken from the spreadsheet's own README, not invented here:
--     A  official GB Tourism / government coordinate
--          -> published and marked verified
--     B  exact mapped feature with a traceable reference
--          -> published, not marked verified
--     C  useful location, field-check the pin before treating it
--        as fully verified
--          -> published, not marked verified, and FIELD-CHECK
--             PENDING written into Source so it is visible
--     D  "Do not publish as an exact navigation pin yet"
--          -> not published, and no coordinates stored at all
--
--   The sheet also says blank coordinates are deliberate and must
--   not be filled with guesses. Nothing here fills one in.
--
-- SAFETY
--   Insert-only after the scoped delete, guarded by name, so
--   re-running changes nothing.
-- ============================================================

-- Placeholders from phase125 / phase126 that nobody has worked on.
--
-- Matched on the PIN NOT VERIFIED marker rather than on the exact
-- wording after it: phase125 wrote two different sentences, and a
-- delete keyed to one of them left "Hargisa Scenic Streams" behind
-- to sit beside this file's "Hargisa Lungma / Milky Streams" —
-- the same place, on the map twice, under two names.
--
-- Rescue stations are excluded explicitly. Five of those carry the
-- same marker from phase123 and are a different dataset entirely,
-- with phone numbers this file does not have.
delete from public.map_places
 where category <> 'rescue'
   and source like 'PIN NOT VERIFIED%'
   and is_verified is false
   and published is false
   and latitude is null;

insert into public.map_places
  (name, category, region, district, city, latitude, longitude,
   description, source, is_verified, published, status)
select v.name, v.category, 'Gilgit-Baltistan', v.district, v.city,
       v.lat, v.lng, v.description, v.source, v.verified, v.published, 'open'
from (values
{values}
) as v(name, category, district, city, lat, lng, description, source,
       verified, published, source_category)
where not exists (
  select 1 from public.map_places m where lower(m.name) = lower(v.name)
);

-- ============================================================
-- CHECK IT LANDED
--
--   select district,
--          count(*) filter (where published)     as live,
--          count(*) filter (where is_verified)   as verified,
--          count(*) filter (where latitude is null) as unlocated
--     from public.map_places
--    where region = 'Gilgit-Baltistan'
--    group by district order by district;
--
-- In the admin, the field-check queue is:
--   Rego Map -> Pins -> search "FIELD-CHECK"
-- ============================================================

-- ============================================================
-- ROLLBACK
--
-- Only rows still carrying this dataset's source string, so
-- anything edited since is left alone. The phase125 / phase126
-- placeholders deleted above are not restored — re-run those two
-- files if you want them back.
--
--   delete from public.map_places
--    where source like '%GB Tourism%'
--       or source like '%FIELD-CHECK PENDING%'
--       or source like '%visitgilgitbaltistan%';
-- ============================================================
"""


if __name__ == "__main__":
    main()
