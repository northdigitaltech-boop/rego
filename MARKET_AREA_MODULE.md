# Market & Area Management — impact assessment and plan

Status: **Phases 1–4 written and deployed. Nothing is switched on.**

The code is live on Vercel and changes nothing a visitor or provider can see:
the admin tab is behind `NEXT_PUBLIC_MARKET_ADMIN`, the area picker renders
nothing until the tables exist, and enforcement ships disabled.

| Phase | File(s) | State |
|---|---|---|
| 1 — Foundation | `phase72-market-areas.sql` | Written · run in Supabase |
| 2a — Backfill report | `phase73-backfill-report.sql` | Written · run |
| 2b — Geography + areas | `phase74-gb-geography.sql` | Written · **9 `review` places still undecided** |
| 2c — Listings backfill | `phase75-listings-backfill.sql` | Written · **dry run only, not applied** |
| 3 — Admin UI | `lib/markets.ts`, `api/admin/markets`, `market-areas.tsx` | Deployed · **flag off** |
| 4 — Enforcement | `phase76-area-enforcement.sql`, `area-rules.ts`, `area-picker.tsx` | Deployed · **disabled**, hotels only |
| 5 — Public pages / SEO | — | Not started |
| 6 — Go live | — | Not started |

## What must happen before any of this does anything

1. Decide the 9 `review` places in `phase74` (Deosai, Bilamik, Basho,
   Sultanabad, Babusar, Shandur, Sheosar) → flip to `high` → re-run.
2. Read `phase75` sections 3 and 4, then
   `select * from public.backfill_listing_locations(false);`
3. Set `NEXT_PUBLIC_MARKET_ADMIN=1` and check the tree in the admin.
4. Run `phase76`, read section 4, then `enforce_enabled = true` **in staging
   first**.
5. Wire `AreaPicker` into the other 11 provider dashboards — see below.

## Still hotel-only

Phase 4 is wired into `hotel-provider-dashboard.tsx` as the reference. The
same four changes are needed in: homestays, hostels, restaurants, activities,
tour companies, guides, transport, media, coworking, roadside, expeditions.

Per file: `location_id` in the empty form, in the edit populate, spread into
the payload when non-empty, and `<AreaPicker serviceSlug="…">` under the
existing location field. The database trigger already covers every table, so
an unwired dashboard is not a security hole — it just cannot set an area.

---

## 1. What the inspection found

| Area | Reality |
|---|---|
| Location storage | **Free text.** `location text` on ~20 listing tables. No foreign key anywhere. |
| Destinations | **Two sources.** `public.destinations` (8 rows) *and* a hardcoded array in `src/lib/data.ts`. **The sitemap reads the code one.** |
| Service categories | **No database table.** Categories are TypeScript constants in `src/lib/data.ts`. `provider_services.category` is unconstrained text. |
| SEO | Already good. `phase47` added SEO columns to 17 tables plus `seo_redirects` and slug history. Reused, not duplicated. |
| Admin roles | `profiles.role = 'admin'` + `public.is_admin()` (phase29). No "super admin" tier exists. |
| Audit log | `admin_audit_logs` exists but is shaped for user management (`target_user_id`, `field`, `note`). No before/after values. |
| RLS | Permissive project-wide — `using (true)`, "gated at the application layer". `phase30b` lockdown still unrun. |
| Tests | **None.** No test runner in `package.json`. |
| Admin UI | One 2,610-line `admin-dashboard.tsx` with a `Tab` union and a `nav` array. Adding an item is low-risk. |

---

## 2. Conflicts requiring your decision

These are blocking. I've built around them rather than through them.

### 2.1 API enforcement is partial until backfill completes
"Disabled locations cannot be submitted by manually calling the API" needs listings to *have* a `location_id`. Today they hold a string.

**What works immediately (Phase 4):** every *new* submission is validated against the resolved settings.
**What cannot work yet:** governing the ~existing rows, because we don't yet know which area they belong to.

### 2.2 Backfill cannot be fully automated
`"Skardu"` maps cleanly. `"Near Shangrila, Skardu Road"` does not.

`phase73` produces three buckets — **EXACT**, **REVIEW**, **UNMATCHED** — and applies nothing. You resolve REVIEW and UNMATCHED via `location_aliases`. I won't guess a mapping that later attaches a hotel to the wrong district.

### 2.3 `service_categories` is a new table mirroring code — please confirm
You said don't duplicate the service list. **There is no database list to reuse.** A per-area service setting with no foreign key rots the first time a slug changes.

My call: the table holds *identity and referential integrity*; `src/lib/data.ts` stays the source for *display* (icons, taglines, grouping). Seeded from code, never hand-edited. **Say if you'd rather store unvalidated slugs instead.**

### 2.4 Minor-unit currency — I did not do this
Converting `price` columns to smallest-unit integers would rewrite live booking data across every table. **Refused as written.** Markets and locations carry `currency_code`; the price columns are untouched. This needs its own migration, its own plan, and its own rollback.

### 2.5 Strict RLS here, permissive everywhere else
The new tables are `is_admin()`-gated for every write — a deliberate departure from the project pattern, because these tables decide whether an area takes bookings and whether pages get indexed.

**But `phase30b` is still unrun**, so the anon key can still read and write `hotels` directly. Area controls will be genuinely enforced for the new module and *not* for the surrounding system. This gap predates the module; it now matters more.

### 2.6 Tests need a toolchain that doesn't exist
Vitest + Playwright across 59 routes is its own workstream. I'd rather scope it properly than add a token test file that proves nothing.

### 2.7 "Super Admin" tier doesn't exist
There is one `admin` role. Either every admin gets market controls, or `profiles.role` gains a `super_admin` value — which touches authentication. **Your call.** Phase 1 gates on `is_admin()`.

### 2.8 Admin endpoint rate limiting is best-effort
The limiter is in-memory, per Vercel instance. Real limiting needs a shared store (Upstash).

---

## 3. Key design decision: three-state booleans

Every control flag is a **nullable** boolean:

```
NULL   → inherit from nearest ancestor with an explicit value
true   → explicitly enabled here    (override)
false  → explicitly disabled here   (override)
```

This is what makes "inherited or overridden?" answerable without a second table, and makes **"Reset to inherited"** a single `UPDATE ... SET col = NULL`.

A `boolean not null default true` cannot tell "admin chose true" from "nobody decided yet" — and that distinction *is* the feature.

**Safe default when nothing is set: `false`** for everything except `is_active`/`is_public`. An unconfigured area must not silently accept bookings.

`resolve_location_flag(location_id, flag, service)` is the single authority. The admin UI and the API both call it, so they cannot drift.

---

## 4. Files written

| File | Lines | Effect if run |
|---|---|---|
| `supabase/phase72-market-areas.sql` | ~700 | Creates 8 tables, 2 functions, 2 triggers, strict RLS. Adds nullable `location_id`/`market_id` to 19 tables. Seeds Pakistan + GB **inactive and non-public**. |
| `supabase/phase73-backfill-report.sql` | ~250 | **Reads only.** Produces 6 reports + the `location_aliases` decision table. |
| `MARKET_AREA_MODULE.md` | this | — |

**Zero application files changed.** Nothing imports these tables yet.

---

## 5. Remaining phases

| Phase | Work | Risk |
|---|---|---|
| 2 | Review reports → fill `location_aliases` → apply backfill → add FKs | Medium — needs your decisions |
| 3 | Admin UI: tree, Overview/Availability/Services/SEO/Content/Redirects/Audit tabs, behind `NEXT_PUBLIC_MARKET_ADMIN` | Low — additive nav item |
| 4 | Provider form + **server-side** validation on submit | **Highest** — touches the live listing flow |
| 5 | Public location pages, metadata, sitemap, JSON-LD | Medium — SEO regression risk |
| 6 | Flip markets live, gradually | Low if 1–5 are correct |

Phase 4 is where existing providers can be broken. It gets its own rollback and its own QA pass.

---

## 6. Deployment sequence for Phase 1

1. Run `phase72` **in staging**. Read the NOTICEs. Confirm `PUBLIC locations : 0`.
2. Run `phase73` in staging. Read all six reports.
3. Confirm the traveller site, provider dashboards and admin are unchanged.
4. Only then run `phase72` in production. It changes nothing a visitor can see.

**Rollback:** commented block at the bottom of each file. `phase72`'s rollback is fully safe **before** Phase 2 backfill — every added column is still NULL. Afterwards, do not run the column drops.

**Environment variables:** none required for Phase 1.

---

## 7. Manual QA for Phase 1

- [ ] Homepage, `/listings`, `/destinations/skardu`, `/categories/hotels` all load unchanged
- [ ] A provider can still create a listing
- [ ] An existing booking still opens and its voucher still downloads
- [ ] `/admin` loads with no new tab (Phase 3 adds it)
- [ ] `select count(*) from public.locations where is_public is true` → **0**
- [ ] Anon key `insert into locations` → **denied**
- [ ] Anon key `insert into market_audit_logs` → **denied**
- [ ] `select public.resolve_location_flag(<skardu-id>, 'booking_enabled')` → **false** (nothing configured yet)
- [ ] `/sitemap.xml` byte-identical to before

---

## 8. Open risks

1. **`phase30b` unrun** — the surrounding database is still writable with the anon key. This limits what "enforced server-side" can honestly mean.
2. **Destination drift** — sitemap reads code, not the database. Must be reconciled in Phase 5 or the two will disagree.
3. **No tests** — every claim in Phase 4 will rest on manual QA until a runner exists.
4. **Phase 4 is the dangerous one** — it is the only phase that can stop a working provider from listing.
