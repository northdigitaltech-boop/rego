# Team management — implementation map

**Date:** 6 September 2026
**Status:** audit and map only. No code written for this brief yet.

---

## 0. The finding everything else depends on

`public.is_admin()` is used **218 times across 37 migration files**. It is the
authorisation primitive of the whole platform, and it is one boolean:

```sql
select exists (select 1 from public.profiles
                where id = auth.uid() and role = 'admin');
```

`profiles.role` has three values: `customer`, `partner`, `admin`. There is no
distinction between "Super Admin" and "staff" anywhere — in the database, the
API routes, or the UI.

That gives exactly two ways to add a team member, and one of them is a
disaster:

| Approach | Consequence |
|---|---|
| Give staff `role = 'admin'` | They immediately pass all 218 policies. A marketing executive could delete any booking, read every profile, change payment settings. **Never do this.** |
| Give staff a new role | All 218 policies correctly exclude them — and they can do *nothing* until each capability they need is added deliberately. |

**The second is right, and it is why this feature cannot be delivered in one
piece.** `is_admin()` must keep meaning Super Admin and must never be widened.
Staff get a **parallel** primitive, and access is granted one capability at a
time. Every capability is a decision someone has to make on purpose.

This matches what the brief asks for in §7 and §30 — it just means the honest
shape of the work is "a foundation, then one department at a time", not "a team
system".

---

## 1. What already exists and will be reused

| Need | Already in REGO | Verdict |
|---|---|---|
| Identity, sessions, login | `auth.users` + `profiles`, `auth-context.tsx` | **Reuse.** No second identity system — the brief says so and it is right. |
| Admin shell, nav, tables, badges, dialogs | `admin-dashboard.tsx` + `src/components/dashboard/*` | **Reuse.** Team Management becomes another tab. |
| Server-side admin gate | The pattern in `/api/admin/markets/route.ts`: service-role client, read role **from the database, not the request**, then act | **Reuse verbatim.** This is already the correct shape. |
| Audit log | `market_audit_logs` (admin actions), `booking_audit_logs` (cancellations), `subscription_audit_logs` | **Extend the pattern**, one team log. Do not build a fourth shape. |
| Notifications | `notifications` + `notification_preferences` + `notifications.ts` | **Reuse.** §37 says not to build a second one. |
| File upload | `image-upload.tsx` → `uploadToCloudinary` | **Reuse for evidence** — with a caveat, see §4. |
| Geographic scope | `locations` tree, `resolve_location_flag`, `service_locations` (phase99) | **Reuse.** §24's scope is a location id plus its subtree, which `ancestors` already answers in one query. |
| Attribution plumbing | `service_locations` proved the pattern: one table, `listing_table` + `listing_id`, allowlisted | **Reuse the pattern** for attribution across 18 listing tables. |
| Lead pipeline shape | `owner_leads`, `owner_followups`, `owner_notes` in `crm.ts` | **Read, do not reuse.** Those are a *provider's* own CRM, scoped by `owner_email`. Staff leads are a different thing with a different owner. Same shape, different table. |

**Name collision to avoid:** `expedition_team_members` already exists and means
climbers on an expedition. Staff tables must not be called `team_members`
unqualified.

---

## 2. New tables

Nothing here duplicates something that exists. Names follow the repo's
convention (plural, snake_case, `public.`).

**Identity and permissions**

```
staff_departments      slug, name, is_active
staff_roles            slug, name, department_id (nullable = cross-dept)
staff_permissions      slug, module, label            -- the vocabulary
staff_role_permissions role_id, permission_id
staff_members          profile_id -> profiles.id, employee_code, department_id,
                       role_id, job_title, phone, status, joined_at,
                       referral_code, created_by, updated_by
staff_permission_grants staff_id, permission_id, granted (true/false)
                       -- per-person override, both directions
staff_scopes           staff_id, location_id, includes_descendants
```

`employee_code` (`MKT-001`) and `referral_code` are generated **server-side**
and immutable. §3 and §14.

**Work and attribution**

```
staff_leads            business_name, contact, category, stage, staff_id,
                       location_id, provider_ref (nullable until registered)
staff_activities       staff_id, activity_type, lead_id, notes, result,
                       next_follow_up, occurred_at
staff_tasks            title, assigned_to, assigned_by, target, progress,
                       due_at, status
staff_attributions     listing_table, listing_id, staff_id, relation
                       -- relation: referred | created | assisted | reviewed
                       --           | verification_recommended
staff_evidence         staff_id, kind, file_url, notes, status, lead_id
staff_action_requests  entity_table, entity_id, requested_by, reason,
                       recommendation, status, decided_by, decision_notes
staff_audit_logs       staff_id, action, entity_table, entity_id,
                       before, after, occurred_at
staff_targets          staff_id, period, metric, target_value
```

**Why `staff_attributions` is one table, not columns on 18 tables.** The brief
(§12) lists seven attribution fields. Adding seven columns to eighteen listing
tables is 126 columns and a migration every time a category is added. One table
with `relation` answers the same questions, keeps history when a second person
assists later (§33), and reuses the shape `service_locations` already proved.
The cost is the same one: no foreign key on `listing_id`, so `listing_table` is
allowlisted and cleanup is in application code.

**No analytics counters.** §32 is right and the schema follows it: every number
in §18 is a `count(*)` over these tables. Snapshots only if a real query proves
too slow.

---

## 3. Files and routes to extend

| File | Change |
|---|---|
| `src/components/dashboard/admin-dashboard.tsx` | One nav entry, one tab. Nothing else. |
| `src/app/api/admin/staff/route.ts` | **New.** Same shape as the markets route. |
| `src/app/team/*` | **New.** The staff portal — `/team`, not a subdomain. §4 permits this and the existing routing, middleware and session all work unchanged. |
| `src/lib/staff.ts`, `staff-permissions.ts` | **New.** The only files that know these tables. |
| 9 × `*-register.tsx` | Read `?ref=` and pass it to the server. **Never trust it client-side** (§14). |
| `src/lib/notifications.ts` | New `NotifType` values. No new infrastructure. |

Not touched: bookings, payments, traveller flow, provider dashboards, SEO
routes, the location system.

---

## 4. Security model

**One rule: `is_admin()` never changes meaning.** Super Admin stays exactly
what it is today. Staff are a separate population with separate policies.

New primitive, mirroring `is_admin()`:

```sql
public.staff_can(p_permission text, p_location uuid default null)
```

returns true when the caller is an **active** staff member whose role or
personal override grants that permission, and — when a location is given —
whose scope covers it. `security definer`, allowlisted permission slug, same
defensive shape as `owns_listing()` in phase99.

Then:

- **Every §7 action is denied to staff by construction**, because those paths
  check `is_admin()` and no staff member satisfies it. Nothing has to be added
  to block them; the block is the default.
- Staff capability is added policy by policy, `using (public.staff_can('...'))`.
- **Suspension is instant** because `staff_can` reads `status` on every call.
  No token to revoke, no cache to clear.
- Attribution fields are written by the server from the session, never accepted
  from the request body (§13, §30).
- Referral codes resolve **server-side**; a bad code is ignored and registration
  continues (§15).

**Evidence storage is the one place the existing tool is not sufficient.**
`uploadToCloudinary` produces a public URL — fine for a hotel photo, wrong for
a WhatsApp screenshot of a provider conversation. §16 says do not expose
evidence publicly. Options are a signed-delivery Cloudinary preset or Supabase
Storage with a private bucket. **This needs a decision before evidence is
built**; until then, evidence is metadata-only.

---

## 5. Migration approach

Additive and reversible, in the order below. Every phase ships on its own and
leaves the platform working.

1. **Vocabulary and identity** — departments, roles, permissions, staff_members,
   scopes, `staff_can()`. Nothing reads it. Zero user-visible change.
2. **Super Admin screens** — create a member, assign role and scope. Still no
   staff can log in anywhere.
3. **The portal shell** — `/team`, permission-aware navigation, empty
   dashboards. A staff member can now sign in and see only their own page.
4. **Attribution + referral** — `staff_attributions`, referral codes, `?ref=`
   in the registration wizards. **This is the highest-value slice**: from here
   on, who brought a provider is recorded, and every later analytic is a query
   over real data rather than a backfill nobody can do.
5. **Marketing department** — leads, activities, follow-ups, targets. The
   department with the clearest need.
6. **Action requests and the approval centre** — §8, §36.
7. **Verification recommendations** — §9.
8. **Analytics** — §18–21. Last on purpose: it is a set of queries over data
   the earlier phases produce, and it is worthless before there is any.
9. **Service review, content, support** — one at a time.

**Existing records get no attribution and must not be given any.** §38 is
explicit and it is the right call: a listing with no `staff_attributions` row
reads "Not attributed", and guessing would corrupt the only performance data
there is.

---

## 6. What I would build first, and an honest note on size

**Phases 1 and 2** — the vocabulary, `staff_can()`, and the Super Admin screens
to create a member. That is a shippable, inert foundation: it changes nothing
for travellers or providers, and it is what every other phase needs.

Then **phase 4 (attribution and referral) before phase 5 (marketing)**, even
though the brief lists marketing first. Attribution is the thing that cannot be
recovered later — a provider onboarded next week with no referral record is
permanently unattributable, while a marketing dashboard built a month later
loses nothing.

**On size.** This brief has forty sections; it is a system, not a feature —
roughly comparable to the whole provider side of REGO. Nine phases, each with a
migration, server routes, UI and tests. I will not pretend it lands in one
session, and a half-built permission system is worse than none, because it
looks like it is protecting something.

**One thing worth weighing before starting.** REGO has 15 listings and one
admin. This system is built for the moment there are twelve staff across six
departments. Phases 1, 2 and 4 are worth doing now regardless — attribution
especially, since it is the one that expires. Phases 5–9 may be worth having
ready *before* hiring rather than after, or may be worth deferring until there
is a team to manage. That is a business call, not a technical one.
