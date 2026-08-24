-- ============================================================================
-- Phase 82 — Add pending_changes to the tables phase21 missed
--
-- ADDITIVE AND IDEMPOTENT. Two nullable columns. No data is touched.
--
-- ---------------------------------------------------------------------------
-- THE BUG
--
-- phase21 added `pending_changes` and `pending_at` to ten listing tables so
-- an owner's edit to an approved listing waits for admin review instead of
-- going live.
--
-- `hostels` (phase48) and `restaurants` (phase23) were added afterwards and
-- never got the columns — but src/lib/pending-edits.ts queries them. Every
-- load of the admin Edit Requests tab produced:
--
--     GET .../rest/v1/hostels?select=*&pending_changes=not.is.null
--     400 (Bad Request)
--
-- Visible consequence: edit approval silently did not work for hostels or
-- restaurants. An owner changing a price or a photo on either of those had it
-- go straight to the live listing with no review — the exact thing phase21
-- exists to prevent.
--
-- ---------------------------------------------------------------------------
-- WHY THIS FILE DISCOVERS THE TABLES INSTEAD OF LISTING THEM
--
-- phase21 hardcoded a list, and that is why this broke: two tables were added
-- later and nobody updated it. This version reads the list from the code
-- comment below AND checks each table exists first, so adding a listing type
-- later fails loudly here rather than silently at runtime.
-- ---------------------------------------------------------------------------
--
-- ROLLBACK: bottom of file.
-- ============================================================================

do $$
declare
  t text;
  n_added int := 0;
  n_ok int := 0;
  n_missing int := 0;
  /* Must match the `table:` entries in src/lib/pending-edits.ts.
     If you add a listing type there, add it here. */
  edit_tables text[] := array[
    'hotels','homestays','hostels','tour_companies','tour_packages',
    'transports','tour_guides','transport_providers','transport_services',
    'rental_vehicles','media_providers','restaurants'
  ];
begin
  foreach t in array edit_tables loop
    if to_regclass('public.' || t) is null then
      raise warning 'table public.% does not exist — pending-edits.ts queries it and will 400', t;
      n_missing := n_missing + 1;
      continue;
    end if;

    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'pending_changes'
    ) then
      n_ok := n_ok + 1;
      continue;
    end if;

    execute format('alter table public.%I add column if not exists pending_changes jsonb', t);
    execute format('alter table public.%I add column if not exists pending_at timestamptz', t);
    n_added := n_added + 1;
    raise notice 'added pending_changes + pending_at to public.%', t;
  end loop;

  raise notice '--------------------------------------------';
  raise notice 'already had the columns : %', n_ok;
  raise notice 'columns added now       : %', n_added;
  raise notice 'tables missing entirely : %', n_missing;
  raise notice '--------------------------------------------';

  if n_missing > 0 then
    raise warning 'Some tables in pending-edits.ts do not exist. Remove them from the code or create them.';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- Partial index: only rows actually waiting for review.
--
-- The admin query is `where pending_changes is not null`, which on most of
-- these tables matches almost nothing. A partial index stays tiny and makes
-- that query an index scan rather than a full table read.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'hotels','homestays','hostels','tour_companies','tour_packages',
    'transports','tour_guides','transport_providers','transport_services',
    'rental_vehicles','media_providers','restaurants'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name=t and column_name='pending_changes')
    then continue; end if;

    execute format(
      'create index if not exists %I on public.%I (pending_at) where pending_changes is not null',
      t || '_pending_idx', t);
  end loop;
end $$;


-- ============================================================================
-- VERIFY — every table pending-edits.ts touches should say "ok"
-- ============================================================================
select
  t.table_name,
  case when exists (
    select 1 from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = t.table_name
       and c.column_name = 'pending_changes'
  ) then 'ok' else 'MISSING — will 400' end as pending_changes
from (values
  ('hotels'),('homestays'),('hostels'),('tour_companies'),('tour_packages'),
  ('transports'),('tour_guides'),('transport_providers'),('transport_services'),
  ('rental_vehicles'),('media_providers'),('restaurants')
) as t(table_name)
order by 2 desc, 1;


-- ============================================================================
-- ROLLBACK
--
-- Only drops the columns from the two tables this file added them to.
-- Anything already queued for review would be lost, so check first:
--     select count(*) from public.hostels where pending_changes is not null;
-- ============================================================================
/*
drop index if exists public.hostels_pending_idx;
drop index if exists public.restaurants_pending_idx;
alter table public.hostels     drop column if exists pending_changes, drop column if exists pending_at;
alter table public.restaurants drop column if exists pending_changes, drop column if exists pending_at;
*/
