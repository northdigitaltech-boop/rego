/* ============================================================
 * phase106 — team phase 3: what the portal needs to render itself
 *
 * ADDITIVE AND IDEMPOTENT. Two functions, no tables, no data changes.
 * Safe to re-run. ROLLBACK at the bottom.
 *
 * ---------------------------------------------------------------------------
 * WHY A FUNCTION AND NOT SIX SELECTS
 *
 * The portal needs the member, their department, their role, their effective
 * permissions and their scopes. Every one of those is readable under the
 * phase104 self-read policies, so the browser COULD fetch them separately —
 * five round trips on every page load, and then the client would have to
 * merge role permissions with personal overrides itself.
 *
 * That merge is the problem. staff_can() already decides it, in the database.
 * A second copy in TypeScript is a copy that can disagree, and the way it
 * disagrees is that a screen offers something the database then refuses — or
 * worse, hides something the person is entitled to and nobody notices for
 * months.
 *
 * So the same rule is computed once, here, from the same rows.
 *
 * ---------------------------------------------------------------------------
 * THE PERMISSION LIST IS FOR DRAWING, NOT FOR DECIDING
 *
 * What comes back tells the portal which panels to render. It is NOT
 * authorisation. Anyone can edit a response in a browser, so every action
 * still has to pass staff_can() on the server or in an RLS policy — §14 of
 * the brief, "do not rely only on hidden buttons".
 *
 * This function only ever describes the CALLER. There is no parameter to
 * point it at somebody else, so it cannot become a way to read the team.
 * ============================================================ */

do $$
begin
  if to_regprocedure('public.staff_can(text, uuid)') is null then
    raise exception 'public.staff_can is missing — run phase104-staff-foundation.sql first.';
  end if;
end $$;


create or replace function public.my_staff_profile()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when m.id is null then null else jsonb_build_object(
    'staff_id',      m.id,
    'employee_code', m.employee_code,
    'referral_code', m.referral_code,
    'job_title',     m.job_title,
    'status',        m.status,
    'joined_at',     m.joined_at,

    'department', jsonb_build_object(
      'id', d.id, 'slug', d.slug, 'name', d.name, 'code_prefix', d.code_prefix
    ),
    'role', jsonb_build_object(
      'id', r.id, 'slug', r.slug, 'name', r.name
    ),

    /* Effective permissions: what the role carries, minus anything revoked
       for this person, plus anything granted to them alone. Exactly the rule
       staff_can() applies, reading the same three tables. */
    'permissions', coalesce((
      select jsonb_agg(distinct p.slug order by p.slug)
        from public.staff_permissions p
       where (
               exists (
                 select 1 from public.staff_role_permissions rp
                  where rp.role_id = m.role_id
                    and rp.permission_id = p.id
               )
               and not exists (
                 select 1 from public.staff_permission_grants g
                  where g.staff_id = m.id
                    and g.permission_id = p.id
                    and g.granted is false
               )
             )
          or exists (
               select 1 from public.staff_permission_grants g
                where g.staff_id = m.id
                  and g.permission_id = p.id
                  and g.granted is true
             )
    ), '[]'::jsonb),

    /* Where they may act. An empty list is meaningful: a permission that
       asks about a location will refuse everywhere until a scope is set,
       so the portal can say so instead of showing empty screens. */
    'scopes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'location_id',          sc.location_id,
               'name',                 l.name,
               'location_type',        l.location_type,
               'includes_descendants', sc.includes_descendants
             ) order by l.name)
        from public.staff_scopes sc
        join public.locations l on l.id = sc.location_id
       where sc.staff_id = m.id
    ), '[]'::jsonb)
  ) end
  from public.staff_members m
  join public.staff_departments d on d.id = m.department_id
  join public.staff_roles r       on r.id = m.role_id
  where m.profile_id = auth.uid()
    /* Suspended and disabled members get null, the same answer as somebody
       who was never staff. The portal then shows them nothing, and the
       suspension needs no separate screen to take effect. */
    and m.status = 'active';
$$;

comment on function public.my_staff_profile is
  'The CALLER''s own staff record with department, role, effective '
  'permissions and scopes, or null if they are not an active staff member. '
  'For rendering the portal. Never a substitute for staff_can() on a write.';

revoke all on function public.my_staff_profile() from public, anon;
grant execute on function public.my_staff_profile() to authenticated;


/* ============================================================
 * touch_staff_seen() — "last seen", and nothing more
 *
 * §26 of the brief asks for activity tracking. This is the smallest
 * honest piece of it: when the portal loaded, for this person.
 *
 * It writes only the caller's own row, so it cannot be used to make
 * somebody else look active. It records a timestamp and no page, no
 * IP and no session — an attendance log is not what was asked for.
 * ============================================================ */
create or replace function public.touch_staff_seen()
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.staff_members
     set last_seen_at = now()
   where profile_id = auth.uid()
     and status = 'active';
$$;

revoke all on function public.touch_staff_seen() from public, anon;
grant execute on function public.touch_staff_seen() to authenticated;


/* Run as an admin this returns null — an admin is not staff, by design
   (Super Admin is a separate authority, see phase104). Signed in as a team
   member it returns their record.
   The Supabase editor shows only the last result set, so this is last. */
select
  (select count(*) from public.staff_members where status = 'active') as active_staff,
  public.my_staff_profile()                                           as me,
  'null for "me" is expected when running this as an admin'           as note;


/* ------------------------------------------------------------------
 * ROLLBACK. Nothing was written, so this is complete.
 * ------------------------------------------------------------------ */
-- drop function if exists public.touch_staff_seen();
-- drop function if exists public.my_staff_profile();
