# Centralised location system — audit and integration report

**Date:** 2 September 2026
**Scope:** audit → provider-form integration → admin completion.
Traveler **search and filters**, the richer attraction fields, and the
location request system are **not** built. Their state is reported below so
the next pass starts from facts rather than from this document's optimism.

---

## 0. The finding that changed the plan

**Most of the requested system already exists in this repository.** It was
built as "Market & Area Management, Phase 1 of 6" and never finished.

Creating a new `locations` table would have been a duplicate system — the one
thing the brief rules out most firmly. Everything below extends what is there.

| Brief asks for | Already present | Where |
|---|---|---|
| Hierarchical `locations` table | Yes | `phase72-market-areas.sql` |
| `parent_id`, depth, ancestors, path | Yes — maintained by trigger, cycles rejected | same |
| Visibility flags | Yes, and **stronger than specified** — see §4 | same |
| Indexes (parent, type, slug, public) | Yes, incl. a GIN index on `ancestors` | same |
| Per-location SEO | Yes — `location_seo` | same |
| Nearby | Yes — `location_nearby` | same |
| Per-area, per-service settings | Yes — `location_service_settings` | same |
| Audit log | Yes — `market_audit_logs` | same |
| `location_id` on listing tables | Yes, 18 tables (one typo — see §1) | same |
| Real Gilgit-Baltistan tree | Yes — 3 divisions, 11 districts, areas | `phase74`, `77`, `81` |
| Listings attached to locations | Yes | `phase75` |
| Server-side enforcement | Yes, **ships disabled** | `phase76` |
| Admin UI | Yes — flag now removed, see §8 | `market-areas.tsx` |
| Admin API | Yes | `/api/admin/markets` |
| Provider picker | Yes, flat | `area-picker.tsx` |

What was genuinely missing: the **registration wizards**, which were written
before this module existed and had never been connected.

---

## 1. Database changes

Two files, both additive, both with a rollback, both tested in PGlite.

### `phase95-expedition-pros-location.sql` — a bug fix

`phase72` adds `location_id` and `market_id` to listing tables by looping over
a list of table names. The list says `expedition_pros`; the table is
`expedition_professionals`. The loop is guarded:

```sql
if to_regclass('public.' || t) is not null then
```

so the name that does not resolve is skipped rather than raising. **The guard
is what made the typo silent.** phase72 reported success, and that one table
never got the columns — through phase74, 75, 76, 77 and 81, none of which
touch it either.

phase95 adds `location_id uuid` and `market_id uuid` (nullable, no default, no
backfill) plus the same partial index every other listing table has.

### `check-location-system.sql` — read-only

Not a migration. Reports whether each table, column and backfill is actually
present in the database being queried. Counts go through `query_to_xml`, not
plain subqueries, because Postgres resolves table names at parse time — a
`CASE` around a subquery on a missing table does not protect anything.

### Not changed

No column renamed, no table dropped, no data overwritten, no existing RLS
policy touched.

---

## 2. Files changed

| File | Why |
|---|---|
| `src/lib/area-tree.ts` | **New.** Pure logic for turning the flat list of open areas into cascading levels. |
| `src/components/dashboard/area-picker.tsx` | One `<select>` → cascading selects. Same props, so existing callers are unaffected. |
| 9 × `*-register.tsx` | The registration wizards now carry an area. |
| 11 × provider dashboards | Pass the listing's saved `location_id` so the picker is populated when editing. |
| `tests/area-tree.test.ts` | **New.** 30 assertions. |
| `supabase/phase95-…sql`, `supabase/check-location-system.sql` | **New.** See §1. |

| `src/lib/markets.ts` | `FLAG_STATUS` / `FLAG_EFFECT` / `FLAG_NOT_YET`, the inheritance note, and `attraction` + `landmark` types. |
| `src/components/dashboard/market-areas.tsx` | Per-flag "In effect" / "Not wired up yet" badge. |
| `src/components/dashboard/admin-dashboard.tsx` | Feature gate removed. |
| `supabase/phase96-ajk-region.sql` | **New.** AJK, hidden. |

No traveler-facing page, no API route, no booking logic, no auth and no SEO
route was modified. Existing SEO behaviour is unchanged — it already read
these flags (§7).

---

## 3. Location hierarchy

Unchanged from phase72 — a self-referencing tree with `parent_id`, and a
trigger maintaining `depth`, `ancestors[]` and `path_slugs[]`. Depth is not
capped and `location_type` is free text, so a country with an administrative
level Pakistan does not have needs no migration.

Currently seeded:

```
Pakistan  (country)
├── Gilgit-Baltistan  (region)
│   ├── Gilgit Division    → Gilgit, Ghizer, Hunza, Nagar
│   ├── Baltistan Division → Skardu, Shigar, Kharmang, Ghanche, Roundu
│   └── Diamer Division    → Diamer, Astore
└── Khyber Pakhtunkhwa  (region)
    └── Hazara Division    → Mansehra   (where Naran and Kaghan sit)
```

Note the **divisions** between region and district. The brief's example
hierarchy skips them; Gilgit-Baltistan really has them, and phase74 exists
because an earlier placeholder did not. The cascading picker reads the levels
off the data rather than assuming a fixed sequence, so this costs nothing.

**Azad Jammu & Kashmir is now seeded** by `phase96-ajk-region.sql` — region
only, every flag NULL. KPK existed already, but only because Naran and Kaghan
needed a factually correct parent, not as a deliberate market.

---

## 4. Visibility controls

The brief asks for four `boolean` flags. The existing schema has **nine**, and
each is a **nullable** boolean with three meanings:

```
NULL   = inherit from the nearest ancestor that has an explicit value
true   = explicitly enabled here
false  = explicitly disabled here
```

This is better than what was asked for, and worth keeping: a plain
`boolean not null default true` cannot tell "an admin chose this" from "nobody
has decided yet", so "reset to inherited" becomes impossible to express. Here
it is `SET col = NULL`.

Mapping:

| Brief | Schema |
|---|---|
| `is_active` | `is_active` |
| `show_publicly` | `is_public` |
| `allow_provider_listing` | `onboarding_enabled`, `listings_enabled` |
| `allow_traveler_search` | `is_public` (+ `seo_enabled` for indexing) |
| `allow_booking` | `booking_enabled` |

Resolution is done in the database by `resolve_location_flag(id, flag, service)`.
The provider picker calls `areas_open_for_listings(service)`, which uses that
same function — so **the list a provider sees and the rule the trigger enforces
agree by construction, not by two pieces of code being kept in step by hand.**

**KPK and AJK are hidden by two independent mechanisms**, neither of which is
a hardcoded exclusion:

1. Nothing above them sets `is_public`, so the resolver returns false.
2. More importantly, the RLS read policy is `is_public is true` **on the row
   itself** — it does not inherit, because an undecided location must not reach
   the public site through a bug in a recursive resolver.

The second is the real boundary, and it has a consequence that is not obvious:
**setting a region public does not make the districts inside it readable.**
Each area a traveller should reach needs its own explicit `is_public = true`.
Two different meanings of "public", on purpose. The admin UI now says this on
the Visible-on-website row, because it is the first thing that will look
broken.

---

## 5. Existing data compatibility

- Free-text `location` / `city` / `destination` / `address` columns are
  **untouched**. They are still what every listing card renders.
- `useAreaSelection().payload` is `{}` when no area is chosen. Spreading `{}`
  adds no key, so a save with no area selected writes exactly the bytes it
  wrote before.
- Because of that, an untouched picker on an **edit** contributes nothing to
  the update — an existing `location_id` cannot be wiped by a provider who
  ignores the field.
- `AreaPicker` renders **nothing** if Supabase is unconfigured, the tables are
  absent, the query fails, or no areas are open. Every form then behaves
  exactly as it does today.

---

## 6. Provider integration

**Registration wizards — new in this pass.** All nine:

| Wizard | Service slug | Written to |
|---|---|---|
| transport | `transport` | `transport_providers`, `transport_services` |
| travel company | `travel-companies` | `tour_companies`, `tour_packages` |
| guide | `guides` | `tour_guides` |
| media / drone | `photographers` | `media_providers` |
| restaurant | `restaurants` | `restaurants` |
| stay | `hotels` / `homestays` / `hostels` (from `kind`) | the matching table |
| coworking | `coworking` | `coworking_spaces` |
| activity | `activities` | `activities` |
| expedition | `expeditions` | `expedition_companies` **only** — see below |

**Individual expedition professionals are deliberately not wired.** Their table
is the one phase72's typo missed. Sending `location_id` before phase95 has run
would fail the insert and stop a porter registering at all — and Vercel deploys
on push while SQL is run by hand, so the two can arrive in either order. The
branch is wired once phase95 is confirmed.

**Provider dashboards — corrected in this pass.** All eleven were *already*
wired; I initially reported otherwise, having grepped for `location_id`, which
lives inside the hook rather than in the files calling it. What was missing was
the `initial` argument, so editing an existing listing showed empty dropdowns.
Fixed in all eleven.

**The picker itself** changed from one `<select>` listing every area — indented
with `" ".repeat(...)` inside the `<option>`, which never rendered, because HTML
collapses leading whitespace there — to Region → Division → District → Area.

The interesting case is not the happy path. Openness is inherited but
overridable, so an admin may close a district and leave one area inside it
open. That area arrives with a parent that is not in the list. Grouping by
`depth` would orphan it; following parent links and treating a missing parent
as "I am a root" shows it one level up instead of dropping it from a form.

A provider who stops at the district has still said something true, so the
district is what gets saved. Precision is welcome, not required.

---

## 7. Traveler integration

**This section was wrong in the first draft and is corrected here.** I wrote
that the traveller side was untouched. It is not.

Already location-driven:

- `/destinations/[slug]/[service]` decides indexing through `decideIndexable()`,
  which consumes `is_public`, `is_active`, `seo_enabled` and `coming_soon`.
- `sitemap.ts` uses the same function, so the sitemap already respects those
  four flags.
- `/destinations/[slug]` layers `location_seo` metadata over the older
  `destinations` data.

Still not location-driven:

- Traveller **search and filters**, and the category pages, which read the
  free-text columns.
- `location_nearby` exists and nothing public reads it.

**KPK and AJK cannot leak**, and the reason is stronger than inheritance — see
§4. The RLS read policy tests the row's own `is_public`, so an undecided
location is unreadable regardless of what any resolver does.

---

## 8. Admin controls

**Now open.** The `NEXT_PUBLIC_MARKET_ADMIN` gate is removed.

It was there because the tab read and wrote settings nothing consumed. That is
now true of only four of the nine flags, and rather than hide all of them or
show them identically, each row states which it is:

| Flag | Status | Consumed by |
|---|---|---|
| Active | **In effect** | Provider forms, sitemap, indexing |
| Visible on website | **In effect** | RLS read, provider forms, sitemap, indexing |
| New listings | **In effect** | Provider forms, per service |
| SEO / indexable | **In effect** | Sitemap, per-service destination pages |
| Coming soon | **In effect** | Sitemap, per-service destination pages |
| Provider registration | Not wired up | — |
| Bookings | Not wired up | — |
| Manual approval required | Not wired up | — |
| Featured destination | Not wired up | — |

The four unwired ones carry an amber badge and a sentence saying what they do
*not* do — "Turning this off does NOT stop bookings being taken in this area".
`FLAG_STATUS` sits beside the labels in `markets.ts`, so wiring a flag up and
correcting its badge are one edit rather than two.

**The enforcement trigger (phase76) still ships disabled.** Closing an area
keeps it out of provider pickers, which is an honest gate for an honest
provider; it is not a guarantee against a direct REST call.

## 9. Attractions

**Partly done.** `attraction` and `landmark` are now location types.

They are locations rather than a separate table, deliberately: an attraction
has a parent, coordinates, a slug, SEO and the same visibility flags, and
`location_type` is free text precisely so a level costs no migration. A
separate table would duplicate all of that, which the brief rules out.

An admin can now place Baltit Fort under Karimabad and give it SEO through the
existing editor. `suggestChildType` still never proposes these, so a district
does not fill with accidental landmarks — an attraction is added on purpose.

**Not done:** the richer attraction fields the brief lists (entry fee, opening
hours, best time to visit, road access, parking, gallery). Those do not fit the
locations table and are the argument for a companion table keyed by
`location_id` — worth designing deliberately rather than in passing.
`src/lib/attractions.ts` still holds the current hardcoded content and is
untouched.

## 10. Future expansion

To open KPK, an admin sets on the KPK row:

```
is_active = true, is_public = true,
onboarding_enabled = true, listings_enabled = true, booking_enabled = true
```

Everything below inherits for the resolver — **but not for reading**. Because
the RLS policy does not inherit (§4), each area a traveller should reach also
needs its own explicit `is_public = true`. No code change, no migration, no
redeploy either way.

**AJK is now seeded** by `phase96-ajk-region.sql`, region only, every flag
NULL — hidden by the same rule that hides KPK. So is a new province,
or a new country — a market row plus a country location.

---

## 11. Testing

**What was actually run.** Being precise, because some of it could not be.

Passed:

- **30 assertions** against the *compiled* `area-tree` module: the closed-parent
  gap, re-seeding when editing, an area that has since closed, a cycle in the
  data, level labelling, and reset-children-on-parent-change.
- **PGlite** on `phase95` — columns added nullable, partial index created,
  re-run clean, rollback exact, guard fires on a database without the table.
- **PGlite** on `check-location-system.sql` against a database with only some
  tables present, so the TABLE MISSING and COLUMN MISSING branches ran.
- **PGlite** on `phase94` (the earlier provider-name backfill) across every
  branch including refusing to revert a hand-edited row.
- `tsc --noEmit` clean after every step.
- `eslint` on all touched files — unchanged from `HEAD`, verified by stashing
  and re-running rather than by assuming.

**Not run, and needs to be:**

- `npm test` — the vitest 4 / rolldown native binding is Windows-installed, so
  the suite cannot run from this environment. `tests/area-tree.test.ts` is
  written and has never executed under vitest.
- `npm run build`.
- **Every flow in the brief's list 1–15 and 16–30.** None has been exercised in
  a browser. In particular nobody has yet watched a real provider register with
  the cascading picker on a phone.

The design assumption that makes this acceptable to ship is that the picker
renders nothing when anything is wrong — so the worst realistic outcome is that
the area field is invisible and registration works as it did last week. That is
an argument for shipping it, not a substitute for testing it.

**Order of operations.** Correcting an earlier draft of this line, which said
phase95 must run before deploying. It must not — nothing in this code sends
`location_id` to `expedition_professionals`, precisely because that branch was
left unwired. The code and the SQL are independent, in either order:

1. **`check-location-system.sql`** — read-only. Run it first, because it
   decides how much of the rest matters. If `locations` is empty, the picker
   renders nothing and this whole pass is inert until the tree is seeded.
2. **Deploy.** Safe on its own.
3. **`phase95-expedition-pros-location.sql`** — whenever. It unblocks wiring
   the individual-expedition branch later; it changes nothing today.

Still outstanding from earlier work, unrelated to locations:
`phase93-booking-cancellation.sql`, `phase86-blog-author-privacy.sql`,
`phase94-provider-name-backfill.sql`.
