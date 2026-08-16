-- ============================================================
-- REGO — Phase 30b: RLS lockdown (schema-aware, safe re-run)
--
-- Replaces phase30-rls-lockdown.sql, which hard-coded a table list and
-- aborted on the first missing table ("relation public.hotels does not
-- exist"), leaving NOTHING applied.
--
-- This version introspects the database first:
--   * tables that do not exist are SKIPPED with a notice, not fatal
--   * tables missing the ownership column are SKIPPED, never guessed at
--   * the policy expression is built from the columns that actually exist
--   * it is idempotent — safe to run again after adding tables
--
-- PREREQUISITE: phase29 (profiles + public.is_admin()) must be applied.
--
-- ⚠ BEFORE YOU RUN STEP 2, RUN STEP 1 AND READ IT.
--   If STEP 1 returns few or no rows, you are almost certainly connected
--   to the wrong Supabase project. Locking down an empty project while
--   the real one stays permissive is worse than doing nothing, because
--   it looks like the job is done. Compare the project ref in this
--   dashboard's URL against NEXT_PUBLIC_SUPABASE_URL in Vercel.
-- ============================================================


-- ============================================================
-- STEP 0 — prerequisite check. Run this on its own first.
-- ============================================================
select
  case
    when to_regprocedure('public.is_admin()') is null
      then '❌ public.is_admin() is MISSING — run phase29 first. Do not continue.'
    else '✅ public.is_admin() exists — safe to continue.'
  end as prerequisite;


-- ============================================================
-- STEP 1 — PREFLIGHT (read-only, changes nothing).
-- Shows exactly what STEP 2 will and will not touch.
--
-- Run this whole STEP 1 block at once: it creates a small read-only
-- helper, then reports. The helper only inspects the catalog — it
-- cannot modify data.
-- ============================================================
create or replace function has_col(p_table text, p_col text)
returns boolean language sql stable as $$
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = p_col
  );
$$;

with candidates(tbl, kind) as (
  values
    ('hotels','listing'),            ('homestays','listing'),
    ('hostels','listing'),           ('tour_companies','listing'),
    ('tour_packages','listing'),     ('transports','listing'),
    ('tour_guides','listing'),       ('media_providers','listing'),
    ('restaurants','listing'),       ('transport_providers','listing'),
    ('transport_services','listing'),('rental_vehicles','listing'),
    ('activities','listing'),        ('coworking_spaces','listing'),
    ('expedition_companies','listing'),('roadside_providers','listing'),
    ('bookings','booking'),          ('homestay_bookings','booking'),
    ('hostel_bookings','booking'),   ('tour_bookings','booking'),
    ('transport_bookings','booking'),('guide_bookings','booking'),
    ('media_bookings','booking'),    ('restaurant_bookings','booking'),
    ('activity_bookings','booking'), ('coworking_bookings','booking')
)
select
  c.tbl,
  c.kind,
  (to_regclass('public.' || c.tbl) is not null)                as table_exists,
  has_col(c.tbl, 'owner_email')                                as has_owner_email,
  has_col(c.tbl, 'customer_email')                             as has_customer_email,
  has_col(c.tbl, 'status')                                     as has_status,
  (select count(*) from pg_policies p
     where p.schemaname = 'public' and p.tablename = c.tbl)     as current_policies,
  case
    when to_regclass('public.' || c.tbl) is null then '⏭ skip — table not in this database'
    when c.kind = 'listing'  and not has_col(c.tbl,'owner_email')
      then '⚠ SKIP — no owner_email column; needs a manual policy'
    when c.kind = 'booking'  and not has_col(c.tbl,'customer_email')
      then '⚠ SKIP — no customer_email column; needs a manual policy'
    else '✅ will be locked down'
  end as plan
from candidates c
order by table_exists desc, c.kind, c.tbl;


-- ============================================================
-- STEP 2 — THE LOCKDOWN.
-- Only run after STEP 1 shows the tables you expect.
-- Watch the NOTICE output: every skip is reported by name.
-- ============================================================
do $$
declare
  t            text;
  pol          record;
  read_expr    text;
  write_expr   text;
  parts        text[];
  n_done       int := 0;
  n_skipped    int := 0;

  listing_tables text[] := array[
    'hotels','homestays','hostels','tour_companies','tour_packages','transports',
    'tour_guides','media_providers','restaurants','transport_providers',
    'transport_services','rental_vehicles','activities','coworking_spaces',
    'expedition_companies','roadside_providers'
  ];
begin
  foreach t in array listing_tables loop

    -- 1. Does the table exist at all?
    if to_regclass('public.' || t) is null then
      raise notice '⏭  % — not in this database, skipped', t;
      n_skipped := n_skipped + 1;
      continue;
    end if;

    -- 2. Without owner_email there is no way to express ownership. Refuse to
    --    guess: a wrong policy either locks owners out of their own listings
    --    or leaves the table open while looking secured.
    if not has_col(t, 'owner_email') then
      raise notice '⚠  % — no owner_email column, SKIPPED (needs a hand-written policy)', t;
      n_skipped := n_skipped + 1;
      continue;
    end if;

    -- 3. Build the read rule from the columns this table actually has.
    parts := array['owner_email = auth.email()', 'public.is_admin()'];
    if has_col(t, 'status') then
      parts := array_prepend($q$status = 'approved'$q$, parts);
    else
      raise notice 'ℹ  % — no status column; public read is NOT granted on it', t;
    end if;
    read_expr  := array_to_string(parts, ' or ');
    write_expr := 'owner_email = auth.email() or public.is_admin()';

    execute format('alter table public.%I enable row level security', t);

    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    execute format('create policy "p_read"   on public.%I for select using (%s)', t, read_expr);
    execute format('create policy "p_insert" on public.%I for insert with check (%s)', t, write_expr);
    execute format('create policy "p_update" on public.%I for update using (%s) with check (%s)',
                   t, write_expr, write_expr);
    execute format('create policy "p_delete" on public.%I for delete using (%s)', t, write_expr);

    raise notice '✅ % — locked down', t;
    n_done := n_done + 1;
  end loop;

  raise notice '--- listing tables: % secured, % skipped ---', n_done, n_skipped;
end $$;


-- ---------- BOOKING TABLES ----------
do $$
declare
  t          text;
  pol        record;
  read_expr  text;
  ins_expr   text;
  del_expr   text;
  has_owner  boolean;
  n_done     int := 0;
  n_skipped  int := 0;

  booking_tables text[] := array[
    'bookings','homestay_bookings','hostel_bookings','tour_bookings',
    'transport_bookings','guide_bookings','media_bookings',
    'restaurant_bookings','activity_bookings','coworking_bookings'
  ];
begin
  foreach t in array booking_tables loop

    if to_regclass('public.' || t) is null then
      raise notice '⏭  % — not in this database, skipped', t;
      n_skipped := n_skipped + 1;
      continue;
    end if;

    -- customer_email is the minimum needed to say "this is my booking".
    if not has_col(t, 'customer_email') then
      raise notice '⚠  % — no customer_email column, SKIPPED', t;
      n_skipped := n_skipped + 1;
      continue;
    end if;

    has_owner := has_col(t, 'owner_email');

    read_expr := 'customer_email = auth.email()'
              || case when has_owner then ' or owner_email = auth.email()' else '' end
              || ' or public.is_admin()';
    ins_expr  := 'customer_email = auth.email() or public.is_admin()';
    -- Deletion stays with the owner and admin. If there is no owner column,
    -- only an admin may delete — the safe direction to fail.
    del_expr  := case when has_owner
                   then 'owner_email = auth.email() or public.is_admin()'
                   else 'public.is_admin()' end;

    if not has_owner then
      raise notice 'ℹ  % — no owner_email; providers cannot see these rows via RLS', t;
    end if;

    execute format('alter table public.%I enable row level security', t);

    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    execute format('create policy "b_read"   on public.%I for select using (%s)', t, read_expr);
    execute format('create policy "b_insert" on public.%I for insert with check (%s)', t, ins_expr);
    execute format('create policy "b_update" on public.%I for update using (%s) with check (%s)',
                   t, read_expr, read_expr);
    execute format('create policy "b_delete" on public.%I for delete using (%s)', t, del_expr);

    raise notice '✅ % — locked down', t;
    n_done := n_done + 1;
  end loop;

  raise notice '--- booking tables: % secured, % skipped ---', n_done, n_skipped;
end $$;


-- ---------- MESSAGES ----------
-- Interim rule: must be signed in to read; may only post as yourself.
-- Anonymous read is removed. Per-thread restriction still needs a
-- participants table — that limitation is real and unchanged from phase30.
do $$
declare pol record;
begin
  if to_regclass('public.messages') is null then
    raise notice '⏭  messages — not in this database, skipped';
  elsif not has_col('messages', 'sender_email') then
    raise notice '⚠  messages — no sender_email column, SKIPPED';
  else
    execute 'alter table public.messages enable row level security';
    for pol in select policyname from pg_policies
      where schemaname = 'public' and tablename = 'messages'
    loop
      execute format('drop policy if exists %I on public.messages', pol.policyname);
    end loop;
    create policy "m_read"   on public.messages for select using (auth.uid() is not null);
    create policy "m_insert" on public.messages for insert with check (sender_email = auth.email());
    raise notice '✅ messages — locked down';
  end if;
end $$;


-- ---------- STORAGE: payment proofs ----------
-- Only signed-in users may read (sign) or upload proofs.
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice '⏭  storage.objects unavailable, skipped';
  else
    drop policy if exists "payment_proofs_read"   on storage.objects;
    drop policy if exists "payment_proofs_insert" on storage.objects;
    create policy "payment_proofs_read" on storage.objects
      for select using (bucket_id = 'payment-proofs' and auth.uid() is not null);
    create policy "payment_proofs_insert" on storage.objects
      for insert with check (bucket_id = 'payment-proofs' and auth.uid() is not null);
    raise notice '✅ storage payment-proofs — locked down';
  end if;
end $$;


-- ============================================================
-- STEP 3 — VERIFY. Run after STEP 2.
-- Anything still listed here is genuinely open to the public.
-- An empty result is the goal.
-- ============================================================
select
  p.tablename,
  p.policyname,
  p.cmd,
  p.qual as using_expression
from pg_policies p
where p.schemaname = 'public'
  and (p.qual = 'true' or p.with_check = 'true')
order by p.tablename, p.policyname;

-- Tables with RLS switched OFF entirely — these bypass policies completely.
select c.relname as table_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by c.relname;


-- ============================================================
-- STEP 4 — ROLLBACK (only if the app breaks).
-- Uncomment and run. This re-opens the listed tables completely,
-- so treat it as an emergency measure and re-secure afterwards.
-- ============================================================
-- do $$
-- declare t text; pol record;
-- begin
--   foreach t in array array[
--     'hotels','homestays','hostels','tour_companies','tour_packages','transports',
--     'tour_guides','media_providers','restaurants','transport_providers',
--     'transport_services','rental_vehicles','activities','coworking_spaces',
--     'expedition_companies','roadside_providers','bookings','homestay_bookings',
--     'hostel_bookings','tour_bookings','transport_bookings','guide_bookings',
--     'media_bookings','restaurant_bookings','activity_bookings','coworking_bookings'
--   ] loop
--     if to_regclass('public.' || t) is null then continue; end if;
--     for pol in select policyname from pg_policies
--       where schemaname = 'public' and tablename = t
--     loop
--       execute format('drop policy if exists %I on public.%I', pol.policyname, t);
--     end loop;
--     execute format('create policy "open_all" on public.%I for all using (true) with check (true)', t);
--     raise notice '↩ % — reopened', t;
--   end loop;
-- end $$;
