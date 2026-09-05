/* ============================================================
 * phase104 — team management, phase 1: who staff are and what
 *            they are allowed to do
 *
 * ADDITIVE AND IDEMPOTENT. Safe to re-run. Nothing in the
 * application reads any of this yet, so running it changes no
 * behaviour for travellers, providers or the admin.
 *
 * ---------------------------------------------------------------------------
 * THE DECISION THIS FILE IS BUILT AROUND
 *
 * public.is_admin() is used 218 times across 37 migrations. It is the
 * authorisation primitive of the entire platform and it is one boolean:
 * profiles.role = 'admin'.
 *
 * There is no distinction anywhere between "Super Admin" and "staff". So
 * there were two ways to add a team member:
 *
 *   Give them role = 'admin'   — they instantly pass all 218 policies. A
 *                                marketing executive could delete bookings and
 *                                change payment settings. Never.
 *
 *   Give them something else   — all 218 policies correctly exclude them, and
 *                                they can do nothing until each capability is
 *                                added on purpose.
 *
 * The second, and this file does not touch is_admin() at all. Super Admin
 * keeps meaning exactly what it means today. Staff are a separate population
 * with a parallel primitive, staff_can(), and every capability they gain is a
 * policy someone writes deliberately.
 *
 * The consequence is that this feature arrives in pieces rather than at once.
 * That is the honest shape of it: a half-built permission system that looks
 * complete is worse than none.
 *
 * ---------------------------------------------------------------------------
 * NAMING
 *
 * Everything is prefixed `staff_`. `expedition_team_members` already exists
 * and means climbers on an expedition — an unqualified `team_members` would
 * be a genuine ambiguity in a codebase where both appear.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles is missing — run phase29-auth-profiles.sql first.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing — run phase29-auth-profiles.sql first.';
  end if;
  if to_regclass('public.locations') is null then
    raise exception 'public.locations is missing — run phase72-market-areas.sql first.';
  end if;
end $$;


/* ============================================================
 * 1. DEPARTMENTS
 *
 * code_prefix is what employee codes are built from: MKT-001,
 * VER-001. Kept on the department rather than derived from the
 * name, because a department can be renamed and an employee code
 * must never change.
 * ============================================================ */
create table if not exists public.staff_departments (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  code_prefix   text not null unique,
  description   text,
  is_active     boolean not null default true,
  display_order int not null default 100,
  created_at    timestamptz not null default now(),

  constraint staff_departments_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint staff_departments_prefix_format check (code_prefix ~ '^[A-Z]{2,4}$')
);


/* ============================================================
 * 2. ROLES
 *
 * department_id NULL means the role crosses departments, which is
 * what the brief's "optional cross-department permissions" needs
 * without a second mechanism.
 * ============================================================ */
create table if not exists public.staff_roles (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  department_id uuid references public.staff_departments(id) on delete restrict,
  description   text,
  is_active     boolean not null default true,
  display_order int not null default 100,
  created_at    timestamptz not null default now(),

  constraint staff_roles_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists staff_roles_dept_idx on public.staff_roles (department_id);


/* ============================================================
 * 3. PERMISSIONS — the vocabulary
 *
 * A row per capability. Business logic never hardcodes a role; it
 * asks staff_can('review_services'). Adding a capability is a row,
 * not a deploy.
 *
 * Nothing that belongs to Super Admin appears here. Deletion,
 * badges, verification approval, payment settings and permission
 * changes are absent ON PURPOSE — a permission that does not exist
 * cannot be granted by mistake.
 * ============================================================ */
create table if not exists public.staff_permissions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  module      text not null,
  label       text not null,
  description text,
  created_at  timestamptz not null default now(),

  constraint staff_permissions_slug_format check (slug ~ '^[a-z0-9]+(_[a-z0-9]+)*$')
);

create index if not exists staff_permissions_module_idx on public.staff_permissions (module);

create table if not exists public.staff_role_permissions (
  role_id       uuid not null references public.staff_roles(id) on delete cascade,
  permission_id uuid not null references public.staff_permissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (role_id, permission_id)
);


/* ============================================================
 * 4. STAFF MEMBERS
 *
 * profile_id, not a second identity system. A staff member IS a
 * REGO account with a row here; login, sessions and password reset
 * are the ones that already exist.
 *
 * status is checked on every permission call, so suspending
 * someone takes effect on their next request — no token to revoke
 * and no cache to wait out.
 * ============================================================ */
create table if not exists public.staff_members (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null unique references public.profiles(id) on delete restrict,

  /* Immutable. Attribution points at this, never at a name. */
  employee_code text not null unique,
  referral_code text not null unique,

  department_id uuid not null references public.staff_departments(id) on delete restrict,
  role_id       uuid not null references public.staff_roles(id) on delete restrict,

  job_title     text,
  phone         text,

  status        text not null default 'active',

  joined_at     date,
  last_seen_at  timestamptz,

  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint staff_members_status_known check (status in ('active','suspended','disabled')),
  constraint staff_members_code_format check (employee_code ~ '^[A-Z]{2,4}-[0-9]{3,}$'),
  constraint staff_members_referral_format check (referral_code ~ '^[A-Z0-9][A-Z0-9-]{2,31}$')
);

create index if not exists staff_members_dept_idx    on public.staff_members (department_id);
create index if not exists staff_members_role_idx    on public.staff_members (role_id);
create index if not exists staff_members_active_idx  on public.staff_members (status) where status = 'active';
create index if not exists staff_members_profile_idx on public.staff_members (profile_id);


/* ============================================================
 * 5. PER-PERSON OVERRIDES
 *
 * granted = true adds a permission the role does not carry.
 * granted = false REMOVES one the role does carry.
 *
 * Both directions matter. Without the false case, taking one
 * capability away from one person means inventing a whole role for
 * them, and role sprawl is how permission systems become unreadable.
 * ============================================================ */
create table if not exists public.staff_permission_grants (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references public.staff_members(id) on delete cascade,
  permission_id uuid not null references public.staff_permissions(id) on delete cascade,
  granted       boolean not null,
  note          text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),

  constraint staff_permission_grants_unique unique (staff_id, permission_id)
);


/* ============================================================
 * 6. GEOGRAPHIC SCOPE
 *
 * Reuses the locations tree. includes_descendants means "and
 * everything inside", answered from locations.ancestors in one
 * query rather than a recursive walk.
 *
 * NO SCOPE MEANS NO LOCATION-SCOPED ACCESS, not "everywhere".
 * "All Pakistan" is a scope row on the Pakistan country location
 * with includes_descendants — explicit, visible in the admin, and
 * auditable. An implicit "empty means everything" is how someone
 * ends up with national access because a form was left blank.
 * ============================================================ */
create table if not exists public.staff_scopes (
  id                   uuid primary key default gen_random_uuid(),
  staff_id             uuid not null references public.staff_members(id) on delete cascade,
  location_id          uuid not null references public.locations(id) on delete restrict,
  includes_descendants boolean not null default true,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),

  constraint staff_scopes_unique unique (staff_id, location_id)
);

create index if not exists staff_scopes_staff_idx    on public.staff_scopes (staff_id);
create index if not exists staff_scopes_location_idx on public.staff_scopes (location_id);


/* ============================================================
 * 7. staff_can() — the parallel primitive
 *
 * Deliberately shaped like is_admin(): one function, called from
 * policies, reads the database rather than the request.
 *
 * Returns false for anything it is not sure about — an unknown
 * permission slug, a suspended member, a missing scope. A typo in a
 * policy denies access rather than granting it.
 * ============================================================ */
create or replace function public.staff_can(
  p_permission text,
  p_location   uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff_id uuid;
  v_role_id  uuid;
  v_perm_id  uuid;
  v_override boolean;
begin
  /* Active members only. A suspension takes effect here, on the next
     request, with nothing to revoke. */
  select s.id, s.role_id into v_staff_id, v_role_id
    from public.staff_members s
   where s.profile_id = auth.uid()
     and s.status = 'active';

  if v_staff_id is null then
    return false;
  end if;

  select p.id into v_perm_id
    from public.staff_permissions p
   where p.slug = p_permission;

  /* A permission that does not exist is not a permission. This is what makes
     Super Admin actions unreachable: they have no row here, so no policy can
     ever ask for one and get true. */
  if v_perm_id is null then
    return false;
  end if;

  select g.granted into v_override
    from public.staff_permission_grants g
   where g.staff_id = v_staff_id
     and g.permission_id = v_perm_id;

  if v_override is not null then
    if not v_override then
      return false;                     -- explicitly taken away
    end if;
  elsif not exists (
    select 1 from public.staff_role_permissions rp
     where rp.role_id = v_role_id
       and rp.permission_id = v_perm_id
  ) then
    return false;                       -- the role does not carry it
  end if;

  /* No location asked about — the permission alone is the answer. */
  if p_location is null then
    return true;
  end if;

  /* `= any(l.ancestors)` against the array itself, not against a subquery
     returning it. A subquery yields one uuid[] VALUE, so `= any (select
     ancestors ...)` compares a uuid to a set of arrays and fails to resolve an
     operator — which is what it did the first time this was run. */
  return exists (
    select 1
      from public.staff_scopes sc
     where sc.staff_id = v_staff_id
       and (
         sc.location_id = p_location
         or (
           sc.includes_descendants
           and exists (
             select 1
               from public.locations l
              where l.id = p_location
                and sc.location_id = any (l.ancestors)
           )
         )
       )
  );
end $$;

comment on function public.staff_can is
  'True when the caller is an ACTIVE staff member whose role or personal '
  'override grants the permission, and whose scope covers the location if one '
  'is given. Never grants anything is_admin() controls: those permissions do '
  'not exist as rows.';

revoke all on function public.staff_can(text, uuid) from public, anon;
grant execute on function public.staff_can(text, uuid) to authenticated;


/* Convenience: is the caller staff at all, whatever their permissions?
   Used by the portal to decide whether to render itself. */
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.staff_members
     where profile_id = auth.uid() and status = 'active'
  );
$$;

revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;


/* ============================================================
 * 8. EMPLOYEE CODE GENERATION
 *
 * Server-side and sequential per department: MKT-001, MKT-002.
 * Never derived from a name — people share names, change them, and
 * leave, and attribution has to outlive all three.
 * ============================================================ */
create or replace function public.next_employee_code(p_department_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_next   int;
begin
  select code_prefix into v_prefix
    from public.staff_departments where id = p_department_id;
  if v_prefix is null then
    raise exception 'unknown department';
  end if;

  /* Highest existing number for this prefix, plus one. Reads the codes
     themselves rather than a counter, so a deleted row does not leave a gap
     that a later insert reuses — a reused employee code would silently
     re-attribute someone else's work. */
  select coalesce(max(substring(employee_code from '[0-9]+$')::int), 0) + 1
    into v_next
    from public.staff_members
   where employee_code like v_prefix || '-%';

  return v_prefix || '-' || lpad(v_next::text, 3, '0');
end $$;

revoke all on function public.next_employee_code(uuid) from public, anon, authenticated;


/* ============================================================
 * 9. ROW LEVEL SECURITY
 *
 * Super Admin manages everything. A staff member may read the
 * vocabulary and their OWN row — enough for the portal to render a
 * permission-aware menu, and nothing about anybody else.
 * ============================================================ */
alter table public.staff_departments        enable row level security;
alter table public.staff_roles              enable row level security;
alter table public.staff_permissions        enable row level security;
alter table public.staff_role_permissions   enable row level security;
alter table public.staff_members            enable row level security;
alter table public.staff_permission_grants  enable row level security;
alter table public.staff_scopes             enable row level security;

/* The vocabulary is readable by any signed-in staff member: it is a list of
   department names and permission labels, and the portal needs it to draw a
   menu. It says nothing about who has what. */
do $$
declare t text;
begin
  foreach t in array array['staff_departments','staff_roles','staff_permissions','staff_role_permissions']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_staff() or public.is_admin())',
      t || '_staff_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_write', t);
  end loop;
end $$;

/* Own row only. A marketing executive has no business reading another
   department's staff list, their phone numbers or their scopes. */
drop policy if exists staff_members_self_read on public.staff_members;
create policy staff_members_self_read on public.staff_members
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists staff_members_admin_write on public.staff_members;
create policy staff_members_admin_write on public.staff_members
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists staff_grants_self_read on public.staff_permission_grants;
create policy staff_grants_self_read on public.staff_permission_grants
  for select using (
    public.is_admin()
    or staff_id in (select id from public.staff_members where profile_id = auth.uid())
  );

drop policy if exists staff_grants_admin_write on public.staff_permission_grants;
create policy staff_grants_admin_write on public.staff_permission_grants
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists staff_scopes_self_read on public.staff_scopes;
create policy staff_scopes_self_read on public.staff_scopes
  for select using (
    public.is_admin()
    or staff_id in (select id from public.staff_members where profile_id = auth.uid())
  );

drop policy if exists staff_scopes_admin_write on public.staff_scopes;
create policy staff_scopes_admin_write on public.staff_scopes
  for all using (public.is_admin()) with check (public.is_admin());


/* ============================================================
 * 10. SEED — departments, roles, and the permission vocabulary
 *
 * No people. Creating staff is the admin's job, in the admin.
 * ============================================================ */
insert into public.staff_departments (slug, name, code_prefix, display_order) values
  ('marketing',            'Marketing',            'MKT', 1),
  ('service-review',       'Service Review',       'REV', 2),
  ('provider-verification','Provider Verification','VER', 3),
  ('content',              'Content',              'CON', 4),
  ('customer-support',     'Customer Support',     'SUP', 5),
  ('operations',           'Operations',           'OPS', 6)
on conflict (slug) do nothing;

insert into public.staff_permissions (slug, module, label) values
  ('view_services',              'services',     'View services'),
  ('review_services',            'services',     'Review services'),
  ('edit_service_limited',       'services',     'Edit service (limited fields)'),
  ('request_service_changes',    'services',     'Request changes to a service'),
  ('recommend_service_approval', 'services',     'Recommend a service for approval'),
  ('flag_service',               'services',     'Flag a service'),
  ('temporarily_hide_service',   'services',     'Temporarily hide a service'),

  ('view_verification',          'verification', 'View verification cases'),
  ('review_documents',           'verification', 'Review verification documents'),
  ('request_verification_changes','verification','Request more documents'),
  ('recommend_verification',     'verification', 'Recommend verification'),
  ('flag_verification_issue',    'verification', 'Flag a verification issue'),

  ('view_blogs',                 'content',      'View blog posts'),
  ('create_blog',                'content',      'Create a blog post'),
  ('edit_blog',                  'content',      'Edit a blog post'),
  ('publish_blog',               'content',      'Publish a blog post'),
  ('unpublish_blog',             'content',      'Unpublish a blog post'),

  ('view_destinations',          'content',      'View destinations'),
  ('create_destination',         'content',      'Create a destination'),
  ('edit_destination',           'content',      'Edit a destination'),
  ('publish_destination',        'content',      'Publish a destination'),

  ('view_locations',             'locations',    'View locations'),
  ('add_location',               'locations',    'Add a location'),
  ('edit_location',              'locations',    'Edit a location'),
  ('add_attraction',             'locations',    'Add an attraction'),

  ('view_reviews',               'reviews',      'View reviews'),
  ('moderate_reviews',           'reviews',      'Moderate reviews'),
  ('flag_review',                'reviews',      'Flag a review'),

  ('view_tickets',               'support',      'View support tickets'),
  ('respond_tickets',            'support',      'Respond to tickets'),
  ('escalate_ticket',            'support',      'Escalate a ticket'),

  ('view_own_analytics',         'analytics',    'View own analytics'),
  ('view_department_analytics',  'analytics',    'View department analytics'),

  ('view_tasks',                 'tasks',        'View tasks'),
  ('update_own_tasks',           'tasks',        'Update own tasks'),

  ('view_leads',                 'marketing',    'View leads'),
  ('manage_own_leads',           'marketing',    'Create and update own leads'),
  ('log_activity',               'marketing',    'Log an activity'),
  ('upload_evidence',            'marketing',    'Upload evidence')
on conflict (slug) do nothing;

do $$
declare
  d_mkt uuid; d_rev uuid; d_ver uuid; d_con uuid; d_sup uuid; d_ops uuid;
begin
  select id into d_mkt from public.staff_departments where slug = 'marketing';
  select id into d_rev from public.staff_departments where slug = 'service-review';
  select id into d_ver from public.staff_departments where slug = 'provider-verification';
  select id into d_con from public.staff_departments where slug = 'content';
  select id into d_sup from public.staff_departments where slug = 'customer-support';
  select id into d_ops from public.staff_departments where slug = 'operations';

  insert into public.staff_roles (slug, name, department_id, display_order) values
    ('operations-manager', 'Operations Manager',  d_ops, 1),
    ('marketing-manager',  'Marketing Manager',   d_mkt, 2),
    ('marketing-executive','Marketing Executive', d_mkt, 3),
    ('service-reviewer',   'Service Reviewer',    d_rev, 4),
    ('verification-officer','Verification Officer',d_ver, 5),
    ('content-manager',    'Content Manager',     d_con, 6),
    ('support-executive',  'Support Executive',   d_sup, 7)
  on conflict (slug) do nothing;
end $$;

/* Role -> permission defaults. Deliberately conservative: publish_blog is NOT
   given to the Content Manager, because the brief says publishing is separately
   configurable and the safe default for "can put words on the public site" is
   no. Super Admin grants it per person. */
do $$
declare
  r record;
  perms text[];
  p text;
  v_role uuid;
  v_perm uuid;
begin
  for r in
    select * from (values
      ('marketing-executive', array['view_leads','manage_own_leads','log_activity',
                                    'upload_evidence','view_tasks','update_own_tasks',
                                    'view_own_analytics','view_locations']),
      ('marketing-manager',   array['view_leads','manage_own_leads','log_activity',
                                    'upload_evidence','view_tasks','update_own_tasks',
                                    'view_own_analytics','view_department_analytics',
                                    'view_locations']),
      ('service-reviewer',    array['view_services','review_services','request_service_changes',
                                    'recommend_service_approval','flag_service',
                                    'view_tasks','update_own_tasks','view_own_analytics',
                                    'view_reviews','view_locations']),
      ('verification-officer',array['view_verification','review_documents',
                                    'request_verification_changes','recommend_verification',
                                    'flag_verification_issue','view_tasks','update_own_tasks',
                                    'view_own_analytics','view_locations']),
      ('content-manager',     array['view_blogs','create_blog','edit_blog',
                                    'view_destinations','create_destination','edit_destination',
                                    'view_locations','add_attraction',
                                    'view_tasks','update_own_tasks','view_own_analytics']),
      ('support-executive',   array['view_tickets','respond_tickets','escalate_ticket',
                                    'view_tasks','update_own_tasks','view_own_analytics']),
      ('operations-manager',  array['view_services','view_verification','view_leads',
                                    'view_tasks','view_own_analytics','view_department_analytics',
                                    'view_locations','view_reviews'])
    ) as t(role_slug, permission_slugs)
  loop
    select id into v_role from public.staff_roles where slug = r.role_slug;
    if v_role is null then continue; end if;

    perms := r.permission_slugs;
    foreach p in array perms loop
      select id into v_perm from public.staff_permissions where slug = p;
      if v_perm is null then
        raise notice 'unknown permission "%" for role %', p, r.role_slug;
        continue;
      end if;
      insert into public.staff_role_permissions (role_id, permission_id)
      values (v_role, v_perm)
      on conflict do nothing;
    end loop;
  end loop;
end $$;


/* What exists now. No people — creating those is the admin's job.
   The Supabase editor shows only the last result set, so this is last. */
select
  d.name                                                        as department,
  r.name                                                        as role,
  count(rp.permission_id)                                       as permissions,
  (select count(*) from public.staff_members m where m.role_id = r.id) as members
from public.staff_roles r
join public.staff_departments d on d.id = r.department_id
left join public.staff_role_permissions rp on rp.role_id = r.id
group by d.display_order, d.name, r.display_order, r.name
order by d.display_order, r.display_order;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * Safe while no staff members exist. Check first:
 *   select count(*) from public.staff_members;
 * ------------------------------------------------------------------ */
-- drop function if exists public.next_employee_code(uuid);
-- drop function if exists public.is_staff();
-- drop function if exists public.staff_can(text, uuid);
-- drop table if exists public.staff_scopes;
-- drop table if exists public.staff_permission_grants;
-- drop table if exists public.staff_members;
-- drop table if exists public.staff_role_permissions;
-- drop table if exists public.staff_permissions;
-- drop table if exists public.staff_roles;
-- drop table if exists public.staff_departments;
