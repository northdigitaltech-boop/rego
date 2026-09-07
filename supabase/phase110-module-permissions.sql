/* ============================================================
 * phase110 — one permission per admin module, and the policies to match
 *
 * ADDITIVE AND IDEMPOTENT. Safe to re-run. ROLLBACK at the bottom.
 *
 * ---------------------------------------------------------------------------
 * THE PROBLEM THIS SOLVES
 *
 * The Roles screen can tick a permission, and the portal can show a tab. But
 * every one of those admin modules writes STRAIGHT TO POSTGRES from the
 * browser, and their policies say `is_admin()`. So showing a team member the
 * Events screen without this migration gives them a screen that opens, lets
 * them type, and refuses on save — the exact experience I have spent this
 * work avoiding.
 *
 * ---------------------------------------------------------------------------
 * NOTHING EXISTING IS DROPPED
 *
 * Permissive RLS policies are OR'd together. So this ADDS a policy per table
 * rather than rewriting the admin one:
 *
 *     existing:  using (public.is_admin())
 *     added:     using (public.staff_manages('events'))
 *
 * An admin still passes through the first, unchanged and untouched. There is
 * no window during this migration where Super Admin loses anything, and the
 * rollback is a drop of the added policies and nothing else.
 *
 * Rewriting the originals to `is_admin() or staff_can(...)` would have been
 * tidier to read and would have meant editing thirty policies whose exact
 * text I would have had to reproduce correctly, on live tables. Not worth it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY ABSENT
 *
 * Password Update Clients, Manage & Delete, Legal & Policies, Send
 * Notification, Subscription & Monetization, Team Management and Users get no
 * permission here. Passwords, deletion, legal text, mass email, money and
 * permissions themselves stay with Super Admin — §12 of the brief, and the
 * same rule as everywhere else in this system: a permission that does not
 * exist cannot be granted by mistake.
 *
 * Listing tables are also absent. Their policies are about ROWS and silent
 * about COLUMNS, so an owner can already write status = 'approved' on their
 * own listing. Adding staff to that is building on a floor that needs fixing
 * first — see MARKETING-ADMIN-MAP.md §0.
 * ============================================================ */

do $$
begin
  if to_regprocedure('public.staff_can(text, uuid)') is null then
    raise exception 'public.staff_can is missing — run phase104-staff-foundation.sql first.';
  end if;
end $$;


/* ============================================================
 * staff_manages('events') — sugar over staff_can('manage_events')
 *
 * One function so the thirty policies below all read the same and a
 * change of convention is a change in one place.
 * ============================================================ */
create or replace function public.staff_manages(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.staff_can('manage_' || p_module, null);
$$;

revoke all on function public.staff_manages(text) from public, anon;
grant execute on function public.staff_manages(text) to authenticated;


/* ============================================================
 * 1. THE PERMISSIONS
 *
 * module = 'modules' so the Roles screen groups them together and an
 * admin can see the whole delegable surface in one block rather than
 * hunting through nine headings.
 * ============================================================ */
insert into public.staff_permissions (slug, module, label, description) values
  ('manage_events',           'modules', 'Events & Expo',        'Create and edit events'),
  ('manage_road_updates',     'modules', 'Road Updates & Alerts','Post road conditions and alerts'),
  ('manage_safarnama',        'modules', 'Safarnama Stories',    'Moderate and edit traveller stories'),
  ('manage_rego_map',         'modules', 'Rego Map',             'Places, routes and distances on the map'),
  ('manage_coworking',        'modules', 'Co-working Spaces',    'Manage co-working listings'),
  ('manage_expeditions',      'modules', 'Mountaineering & Expeditions', 'Peaks, routes and expedition content'),
  ('manage_jobs_portal',      'modules', 'Jobs Portal',          'Post and manage jobs'),
  ('manage_careers',          'modules', 'Careers & Jobs page',  'Edit the careers page'),
  ('manage_about_page',       'modules', 'About page',           'Edit the about page'),
  ('manage_contact_page',     'modules', 'Contact page',         'Edit the contact page'),
  ('manage_promotions',       'modules', 'Promotions & Ads',     'Homepage promotional slides'),
  ('manage_homepage_hero',    'modules', 'Homepage Hero',        'The homepage hero image'),
  ('manage_solo_travelers',   'modules', 'Connect Solo Traveler','Solo traveller connections'),
  ('manage_service_requests', 'modules', 'Service Requests',     'Provider service requests'),
  ('manage_destinations_pages','modules','Destination pages',    'Destination page content'),
  ('manage_job_applications', 'modules', 'Job Applications',     'Read and process job applications')
on conflict (slug) do nothing;


/* ============================================================
 * 2. THE POLICIES
 *
 * One added policy per table, named staff110_<table> so the rollback
 * can find them and nothing else shares the name.
 *
 * `to_regclass` guard because not every deployment has run every
 * earlier phase — a missing table should skip, not abort the run and
 * leave half the modules working.
 * ============================================================ */
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('events',                  'events'),

      ('road_updates',            'road_updates'),
      ('road_reports',            'road_updates'),
      ('road_reporters',          'road_updates'),

      ('stories',                 'safarnama'),
      ('story_comments',          'safarnama'),

      ('map_places',              'rego_map'),
      ('map_reports',             'rego_map'),
      ('map_road_alerts',         'rego_map'),
      ('road_routes',             'rego_map'),
      ('distance_chart',          'rego_map'),

      ('coworking_spaces',        'coworking'),

      ('expedition_companies',    'expeditions'),
      ('expedition_packages',     'expeditions'),
      ('expedition_peaks',        'expeditions'),
      ('expedition_professionals','expeditions'),
      ('expedition_roles',        'expeditions'),
      ('expedition_routes',       'expeditions'),

      ('jobs',                    'jobs_portal'),
      ('job_applicants',          'jobs_portal'),

      ('careers_content',         'careers'),
      ('about_content',           'about_page'),
      ('contact_content',         'contact_page'),
      ('ad_slides',               'promotions'),
      ('platform_settings',       'homepage_hero'),

      ('solo_travelers',          'solo_travelers'),
      ('solo_connections',        'solo_travelers'),

      ('provider_services',       'service_requests'),
      ('destinations',            'destinations_pages'),
      ('job_applications',        'job_applications')
    ) as t(table_name, module_slug)
  loop
    if to_regclass('public.' || r.table_name) is null then
      raise notice 'skipping %, table not present', r.table_name;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('drop policy if exists %I on public.%I',
                   'staff110_' || r.table_name, r.table_name);
    /* `for all` so one policy covers select, insert, update and delete.
       The read side is already open on most of these; being named on it
       twice costs nothing and means a staff member can always read what
       they are allowed to edit. */
    execute format(
      'create policy %I on public.%I for all using (public.staff_manages(%L)) with check (public.staff_manages(%L))',
      'staff110_' || r.table_name, r.table_name, r.module_slug, r.module_slug
    );
  end loop;
end $$;


/* What an admin sees after running this: sixteen new permissions, nobody
   holding any of them, and every existing policy exactly as it was.
   The Supabase editor shows only the last result set, so this is last. */
select
  (select count(*) from public.staff_permissions where module = 'modules')  as module_permissions,
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname like 'staff110\_%')          as policies_added,
  'Nobody holds these yet — grant them per role or per person.'             as note;


/* ------------------------------------------------------------------
 * ROLLBACK. Drops only what this file added; every original policy is
 * untouched, so Super Admin is unaffected either way.
 *
 *   do $$
 *   declare r record;
 *   begin
 *     for r in select tablename, policyname from pg_policies
 *               where schemaname = 'public' and policyname like 'staff110\_%'
 *     loop
 *       execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
 *     end loop;
 *   end $$;
 *   drop function if exists public.staff_manages(text);
 *   delete from public.staff_permissions where module = 'modules';
 * ------------------------------------------------------------------ */
