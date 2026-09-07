# Marketing Admin — findings before any code

Written because the brief's own first instruction is to inspect the codebase.
Everything below is from the files, not from memory.

---

## 0. The finding that comes before the brief

**A provider can approve their own listing today.**

`phase30-rls-lockdown.sql` sets this policy on every listing table:

```sql
create policy "p_update" on public.<table> for update
  using      (owner_email = auth.email() or public.is_admin())
  with check (owner_email = auth.email() or public.is_admin());
```

That is correct about *rows* and silent about *columns*. `status` is an
ordinary column on the same row, so a provider holding the anon key can send:

```
update hotels set status = 'approved' where id = '<their own listing>'
```

and Postgres will allow it. The same applies to `is_verified` and
`is_featured` wherever those columns sit on the listing row. Nothing else
guards it — I searched for a trigger, a column grant and a check constraint,
and there is none.

The Approvals screen is therefore a convenience for honest providers, not a
gate. **I have not confirmed this against the live database** — I can only
read migrations — so the first thing to do is run the check in §1 and see.

This matters to the brief directly. Section 3 asks for a Marketing Admin
listing-approval queue, and section 15 says permissions must be enforced on
the server, "never rely only on hiding buttons". Building that queue on top of
a table where the applicant can approve themselves would be building a lock
with no wall behind it.

**So this is phase 1, before any Marketing Admin work.**

The fix has a shape that already works elsewhere in this repo: `phase108`
narrows what an assignee may change on a task with
`revoke update ... grant update (status, progress_note)`. The mirror image
here is to revoke `update` on the listing tables from `authenticated` and
re-grant every column *except* `status`, `is_verified` and `is_featured`,
then move those three behind a `security definer` function that checks
`is_admin() or staff_can(...)`. Owners keep editing their listings; nobody
promotes themselves.

---

## 1. Check this against the live database first

```sql
-- What can actually write to a listing table right now?
select tablename, policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'hotels';

-- And which column privileges authenticated holds:
select table_name, privilege_type, column_name
  from information_schema.column_privileges
 where grantee = 'authenticated' and table_name = 'hotels';
```

If `p_update` is present as written above, §0 is real.

---

## 2. What already exists and must be reused

| Thing | Where | Note |
|---|---|---|
| Departments, roles, 39 permissions | `phase104` | live |
| `staff_can(permission, location)` | `phase104` | scope-aware, the one authority |
| `is_staff()`, `my_staff_id()` | `phase104`, `phase107` | live |
| Per-person overrides | `staff_permission_grants` | live, has UI |
| Per-role permissions | `staff_role_permissions` | live, has UI as of the Roles tab |
| Regional scope | `staff_scopes` + `includes_descendants` | **§18 of the brief is already built** |
| Attribution | `phase105` `staff_attributions` | live |
| Leads, activity log | `phase107` | live |
| Tasks | `phase108` | live; §10 partly done |
| Staff CV | `phase109` | live |
| Portal shell + tabs | `src/components/portal/` | live |
| Admin approvals UI | `admin-dashboard.tsx` → `<Approvals>` | client-side |
| Admin verification UI | `admin-dashboard.tsx` → `<VerificationAdmin>` | client-side |
| Listings manager | `admin-listings-manager.tsx` | self-contained |
| Blog editor | `admin-blog.tsx` | self-contained, already in the portal |
| Locations editor | `market-areas.tsx` | self-contained, already in the portal |
| Notifications | `phase50-notifications.sql` | exists; not yet wired to staff |
| Audit tables | `admin_audit_logs`, `market_audit_logs` | reuse, do not add a third |

**Approvals have no API route.** `admin-dashboard.tsx` calls
`setHotelStatus`, `setCompanyStatus`, … directly from the browser. So
"approval is admin-only" is enforced by RLS and by nothing else — which is §0.

---

## 3. What the brief asks for that does NOT exist

| Brief | Status |
|---|---|
| `MARKETING_ADMIN` role | New role row. Trivial. |
| Nested permission object (`services.approve` …) | The existing model is flat slugs. See §5. |
| `approve_listing`, `approve_provider`, `reject_*` permissions | **No rows exist.** Deliberately — phase104 gave staff `recommend_*` only. |
| 5 statuses (Under Review, More Info Required) | Today: `pending`/`approved`/`rejected`. Needs a column change on ~18 tables. |
| Central approval queue | No table. Today each listing table is queried separately. |
| Internal review notes | No table. |
| Request-deletion flow (§12) | Nothing. |
| Business onboarding + duplicate check (§7) | Nothing. `staff_leads` is adjacent but not the same thing. |
| Per-member analytics (§9) | Nothing. |
| Staff notifications (§11) | Table exists, no staff wiring. |
| Task auto-progress (§10) | Tasks exist; counting listings against a target does not. |

---

## 4. Honest note on size

This is bigger than the team system was, and that took nine phases. Sections
2, 3, 4, 7, 9 and 11 are each a migration plus routes plus screens. I am not
going to pretend it lands in one sitting, and a half-built approval system is
worse than none because it looks like it is protecting something.

**A half-built one is also exactly what §0 describes.** That is the argument
for fixing §0 first even though it is not in the brief.

---

## 5. One design decision worth settling before code

The brief's example is nested:

```ts
permissions: { services: { view, create, edit, approve, reject } }
```

The system in the database is flat slugs — `view_services`,
`review_services`, `approve_listing`. Both express the same thing; the flat
one is what `staff_can()`, every RLS policy and both permission screens
already read.

**Recommendation: keep the flat slugs and add the missing ones.** The nested
shape can be produced for display by grouping on `module`, which the portal
already does. Changing the storage model would mean rewriting `staff_can()`
and every policy that calls it, for a presentation preference.

New permission rows needed:

```
approve_listing        reject_listing        request_listing_changes
approve_provider       reject_provider       request_provider_info
edit_any_listing       delete_request        add_internal_note
manage_seo             onboard_business      view_notifications
```

`approve_verification`, badges and permanent deletion stay absent, per §12
and §13 of the brief — Super Admin keeps those, and a permission that does
not exist cannot be granted by mistake.

---

## 6. Suggested order

1. **Lock the status columns.** (§0.) Nothing else is honest without it.
2. New permissions + `MARKETING_ADMIN` role.
3. Central approval queue — one view over the listing tables, plus
   `listing_reviews` for notes and the extra statuses.
4. Approval actions as a server route, replacing the direct client writes,
   checking `is_admin() or staff_can(..., location)`.
5. Portal: Approvals tab reusing the existing components.
6. Business onboarding with duplicate detection.
7. Per-member analytics.
8. Staff notifications.
9. Request-deletion flow.

Steps 1 and 2 are small. Step 3 is the large one.
