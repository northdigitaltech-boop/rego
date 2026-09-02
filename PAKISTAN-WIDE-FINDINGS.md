# Pakistan-wide provider expansion — findings before code

**Date:** 2 September 2026
**Status:** findings only. No code written for this brief yet.

---

## 1. Existing architecture findings

### What already exists and must be reused

A centralised location system was built as "Market & Area Management, Phase 1
of 6" and is largely in place. Full detail is in `LOCATION-SYSTEM-REPORT.md`;
the parts that matter for *this* brief:

| Capability | State |
|---|---|
| Hierarchical `locations` (parent_id, ancestors, path_slugs, depth) | Built, trigger-maintained, cycles rejected |
| Free-text `location_type` | Built — `attraction` and `landmark` added this week |
| Nine three-state flags with inheritance | Built |
| **Per-location, per-service settings** (`location_service_settings`) | **Built** — this is the key to §4 |
| `resolve_location_flag(id, flag, service)` | Built — service override checked before location value at every step |
| `location_id` + `market_id` on 18 listing tables | Built (phase72), backfilled (phase75) |
| Admin UI + admin API + audit log | Built, gate removed this week |
| Cascading provider picker | Built this week |
| Pakistan's provinces | GB, KPK, AJK, Punjab, Sindh, Balochistan, Islamabad (phase96, phase98) |

**Requirement §4 is already satisfiable without new tables.** Pakistan-wide
registration for guides / transport / travel-companies was proved working in
`phase98`: two rows in `location_service_settings` on the Pakistan location,
verified in PGlite — those three resolve `true` in every province while hotels
and restaurants resolve `false` outside Gilgit-Baltistan.

### What does NOT exist — the real gap

**§3 and §6: provider base location vs service coverage.**

There is no relational coverage. What exists instead:

- `service_areas text[]` on exactly **three** tables — `tour_companies`,
  `transport_providers`, `roadside_providers`. Free text, not location ids.
- **Nothing at all** on `tour_guides`, `media_providers`,
  `expedition_companies`, `activities`, `tour_packages`, `rental_vehicles` —
  which is most of the brief's Pakistan-wide list.
- No many-to-many table of any kind. `grep "create table.*(coverage|_areas)"`
  across every migration returns nothing.

So today an Islamabad tour company has exactly one location field, and it means
"where I am". There is nowhere to say "and I serve Skardu, Hunza, Gilgit".

**§7 and §8: search does not use locations at all.**

`listings-browser.tsx` filters client-side on the free-text string:

```ts
const a = l.location.toLowerCase();
const b = location.toLowerCase();
```

and the filter options come from a hardcoded `locations` array in
`src/lib/data.ts:278`. No `location_id`, no coverage, no hierarchy. A Lahore
company serving Skardu would be filtered out of "Skardu" today no matter what
we store, because the string says Lahore.

**§4's three axes do not map cleanly onto the existing flags.**

The brief asks for three independent scopes per category. The schema has:

| Brief axis | Existing flag | Fit |
|---|---|---|
| Provider Registration Scope | `listings_enabled` (+ `onboarding_enabled`) | Good |
| Public Discovery Scope | `is_public`, `seo_enabled` | Good |
| **Service Coverage Scope** | — | **No equivalent** |

Coverage scope is the genuinely new concept, and it needs the coverage table
before it means anything.

---

## 2. Files, tables and components to modify

### New

| Item | Purpose |
|---|---|
| `service_locations` table | The one real gap: many-to-many listing → location with a relation type |
| `phase99-service-locations.sql` | Creates it, with RLS and rollback |
| `src/lib/service-coverage.ts` | Read/write coverage; the only place that knows the table |
| `src/components/dashboard/coverage-picker.tsx` | Multi-select over the same open-areas source the single picker uses |

### Modified — small, additive

| File | Change |
|---|---|
| `src/lib/markets.ts` | A coverage-scope flag alongside the existing ones |
| `src/components/dashboard/market-areas.tsx` | Surface it, same pattern as the others |
| 6 × `*-register.tsx` (company, guide, media, transport, activity, expedition) | Add the coverage step. Only for categories the admin has marked Pakistan-wide |
| 6 × provider dashboards | Same, on edit |
| `src/components/listings/listings-browser.tsx` | Match on coverage as well as the free-text string |

### Explicitly NOT modified

Bookings, auth, payments, provider verification, SEO routes, `sitemap.ts`,
`/destinations/*`, the booking-cancellation module, reviews, favourites.

---

## 3. Database migration requirements

One new table. Additive, nullable, no backfill, rollback included.

```sql
service_locations
-----------------
id             uuid pk
listing_table  text        -- 'tour_companies', 'tour_guides', …
listing_id     uuid
location_id    uuid  -> locations(id)
relation_type  text        -- 'base' | 'service_area' | 'destination' | 'pickup' | 'dropoff'
created_at     timestamptz
unique (listing_table, listing_id, location_id, relation_type)
```

**Why `listing_table` + `listing_id` and not a foreign key.** Rego's listings
live in eighteen separate tables. Postgres has no polymorphic foreign key, so
the alternatives are eighteen join tables or one with the table name in a
column. Eighteen tables would mean eighteen policies, eighteen indexes and a
new one per category forever. The cost of the single table is that the database
cannot enforce that `listing_id` exists — so `listing_table` is constrained to
a known list, and deletes are handled in application code, which is where
Rego's other cross-table cleanup already lives.

**Indexes:** `(listing_table, listing_id)` for "where does this listing
operate", `(location_id, relation_type)` for "who serves Skardu" — that second
one is what search needs.

**No existing column is renamed, dropped or retyped.** `service_areas text[]`
stays exactly where it is and keeps rendering; the new table is read first and
the text array is the fallback.

---

## 4. Proposed scope architecture

Three axes, one mechanism — the one that already exists.

`location_service_settings` is per-location **and** per-service, and
`resolve_location_flag` checks the service row before the location value at
every level of the walk. So a scope is not a new concept; it is a row.

| Brief axis | Expressed as | Set where |
|---|---|---|
| Provider Registration | `listings_enabled` for that service | On Pakistan → nationwide. On Gilgit-Baltistan → GB only. On four provinces → selected regions. |
| Public Discovery | `is_public` / `seo_enabled` | Same |
| **Service Coverage** | `coverage_enabled`, a new column on the same table | Same |

**"GB only", "Selected regions" and "Pakistan wide" are therefore not stored
values.** They are *where the admin clicks*, and the tree already gives them
that. Storing them as an enum as well would be a second source of truth that
can disagree with the first — the failure mode this whole brief exists to
avoid.

The admin screen can offer those three words as shortcuts that write the
underlying rows. That is a UI convenience over one mechanism, not a parallel
system.

---

## 5. Backward-compatibility risks

Ordered by how much they would hurt.

| Risk | Why it could happen | Mitigation |
|---|---|---|
| **Search stops finding existing GB listings** | Changing the filter from string-match to coverage would drop every listing that has no coverage rows — which today is all of them | Match coverage **OR** the existing string. Never replace. Coverage only ever adds results |
| **Provider forms break** | Six wizards and six dashboards touched | Coverage picker follows `AreaPicker`'s rule: renders nothing if it cannot load, and writes nothing when empty |
| **Deleting a listing orphans coverage rows** | No foreign key on `listing_id` | Delete coverage in the same code path as the listing; and orphans are invisible, not harmful — a row pointing at a listing that no longer exists returns nothing on join |
| **KPK/AJK become traveller-visible** | Opening registration nationwide is not the same as opening discovery | Separate axes, already separate flags. The RLS read policy needs an explicit per-row `is_public`, so this cannot happen by inheritance |
| **A Lahore listing appears in "all listings"** | Nationwide registration puts non-GB rows in shared queries | Discovery scope stays GB. Verify after implementing, not assume |
| **Double-counted listings in search** | A listing matching by both coverage and string | Deduplicate by id |

---

## 6. Implementation sequence

Each step is shippable and reversible on its own. Later steps are useless
without earlier ones, so the order is not negotiable.

**Step 1 — `service_locations` + `coverage_enabled`.**
Table, indexes, RLS, rollback. Nothing reads it yet. Zero user-visible change.

**Step 2 — the coverage library and picker.**
`service-coverage.ts` and a multi-select built on the same
`areas_open_for_listings_tree` source the single picker uses. Still not wired
into any form.

**Step 3 — providers can state their coverage.**
Six registration wizards and six dashboards, additive, only for categories the
admin has opened. Providers can now say "based in Islamabad, serving Skardu"
and it is stored properly. Travellers see no change yet.

**Step 4 — search finds them.**
`listings-browser` matches coverage OR the free-text string. The listing card
can show "Based in Islamabad — Serving Gilgit-Baltistan". **This is the step
that changes what travellers see, so it ships alone.**

**Step 5 — admin coverage controls.**
The `coverage_enabled` flag surfaced in Market & Area Management, with the
three shortcut buttons.

**Step 6 — optional, later.**
Migrate the three `service_areas text[]` columns into coverage rows where the
strings match a known location. Non-destructive: the array stays.

---

## What I would ship first

**Steps 1–3.** They are additive, invisible to travellers, and they are what
makes the data correct going forward. Step 4 is the one with real risk — it
changes live search — and it deserves its own pass with its own testing, not to
be bundled with the plumbing.

One thing to decide before Step 4, because it is a product call and not a
technical one: a Lahore tour company serving Skardu should appear under
"Tour Companies in Skardu". Should it *also* appear under an unfiltered
"All tour companies" list, alongside GB-based ones? Coverage says yes;
"Gilgit-Baltistan-first" might say no.
