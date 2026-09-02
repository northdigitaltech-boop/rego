/* ============================================================
 * phase94 — fill in the owner name that listings were saved without
 *
 * THE BUG THIS CLEANS UP
 *   Each of these tables links to its owner by id AND keeps a copy of
 *   the owner's name, because that copy is what the public card prints
 *   as "by …". The provider dashboards have always written it. The
 *   stepped registration wizards did not — so a vehicle or a package
 *   created during registration went live with no name behind it. A
 *   traveller looking at the card could not tell who they would be
 *   dealing with.
 *
 *   The code is fixed. This is for the rows already saved.
 *
 * WHAT IT DOES NOT DO
 *   It only touches rows where the name is NULL. A name that was typed
 *   differently on purpose — a trading name, a corrected spelling — is
 *   left exactly as it is. This script never overwrites an answer that
 *   already exists.
 *
 * ROLLBACK
 *   Every row it changes is recorded in phase94_backfill_log with its
 *   table, id and the value before (always NULL). Section 3 puts them
 *   all back from that log. Run STEP 1 first if you want to see the
 *   count before changing anything.
 * ============================================================ */

/* ------------------------------------------------------------------
 * STEP 1 — look before touching. Read-only; safe to run on its own.
 * ------------------------------------------------------------------ */
select 'transport_services' as tbl, count(*) as missing_name
  from public.transport_services s
  join public.transport_providers p on p.id = s.provider_id
 where s.provider_name is null
union all
select 'rental_vehicles', count(*)
  from public.rental_vehicles r
  join public.transport_providers p on p.id = r.provider_id
 where r.provider_name is null
union all
select 'tour_packages', count(*)
  from public.tour_packages k
  join public.tour_companies c on c.id = k.company_id
 where k.company_name is null
union all
select 'transports', count(*)
  from public.transports t
  join public.tour_companies c on c.id = t.company_id
 where t.company_name is null
union all
select 'tour_guides', count(*)
  from public.tour_guides g
  join public.tour_companies c on c.id = g.company_id
 where g.company_name is null;


/* ------------------------------------------------------------------
 * STEP 2 — the backfill. Run the whole block together.
 *
 * tour_guides is included only where company_id is set. A guide who
 * works for nobody has company_name NULL on purpose, and the join
 * leaves those alone.
 * ------------------------------------------------------------------ */
begin;

create table if not exists public.phase94_backfill_log (
  id          bigserial primary key,
  table_name  text        not null,
  row_id      uuid        not null,
  old_value   text,                    -- always NULL; kept so the undo is literal
  new_value   text        not null,
  changed_at  timestamptz not null default now()
);

/* The log records who owned what and is not for travellers to read. */
alter table public.phase94_backfill_log enable row level security;

drop policy if exists p94_admin_read on public.phase94_backfill_log;
create policy p94_admin_read on public.phase94_backfill_log
  for select using (public.is_admin());
/* No insert policy on purpose — these rows are written by this migration
   running as the table owner, not by anyone holding the anon key. */

with updated as (
  update public.transport_services s
     set provider_name = p.name
    from public.transport_providers p
   where p.id = s.provider_id
     and s.provider_name is null
     and p.name is not null
  returning s.id, p.name
)
insert into public.phase94_backfill_log (table_name, row_id, old_value, new_value)
select 'transport_services', id, null, name from updated;

with updated as (
  update public.rental_vehicles r
     set provider_name = p.name
    from public.transport_providers p
   where p.id = r.provider_id
     and r.provider_name is null
     and p.name is not null
  returning r.id, p.name
)
insert into public.phase94_backfill_log (table_name, row_id, old_value, new_value)
select 'rental_vehicles', id, null, name from updated;

with updated as (
  update public.tour_packages k
     set company_name = c.name
    from public.tour_companies c
   where c.id = k.company_id
     and k.company_name is null
     and c.name is not null
  returning k.id, c.name
)
insert into public.phase94_backfill_log (table_name, row_id, old_value, new_value)
select 'tour_packages', id, null, name from updated;

with updated as (
  update public.transports t
     set company_name = c.name
    from public.tour_companies c
   where c.id = t.company_id
     and t.company_name is null
     and c.name is not null
  returning t.id, c.name
)
insert into public.phase94_backfill_log (table_name, row_id, old_value, new_value)
select 'transports', id, null, name from updated;

with updated as (
  update public.tour_guides g
     set company_name = c.name
    from public.tour_companies c
   where c.id = g.company_id
     and g.company_name is null
     and c.name is not null
  returning g.id, c.name
)
insert into public.phase94_backfill_log (table_name, row_id, old_value, new_value)
select 'tour_guides', id, null, name from updated;

commit;

/* What it did — the Supabase editor shows only the last result set,
   so this is deliberately the last statement. */
select table_name, count(*) as rows_filled
  from public.phase94_backfill_log
 group by table_name
 order by table_name;


/* ------------------------------------------------------------------
 * STEP 3 — ROLLBACK. Only if you need to undo the above.
 * Puts every changed row back to NULL, and only rows this script
 * changed. Anything edited by hand since then is skipped, because the
 * value no longer matches what the log says was written.
 * ------------------------------------------------------------------ */
-- begin;
--
-- update public.transport_services s set provider_name = l.old_value
--   from public.phase94_backfill_log l
--  where l.table_name = 'transport_services' and l.row_id = s.id
--    and s.provider_name is not distinct from l.new_value;
--
-- update public.rental_vehicles r set provider_name = l.old_value
--   from public.phase94_backfill_log l
--  where l.table_name = 'rental_vehicles' and l.row_id = r.id
--    and r.provider_name is not distinct from l.new_value;
--
-- update public.tour_packages k set company_name = l.old_value
--   from public.phase94_backfill_log l
--  where l.table_name = 'tour_packages' and l.row_id = k.id
--    and k.company_name is not distinct from l.new_value;
--
-- update public.transports t set company_name = l.old_value
--   from public.phase94_backfill_log l
--  where l.table_name = 'transports' and l.row_id = t.id
--    and t.company_name is not distinct from l.new_value;
--
-- update public.tour_guides g set company_name = l.old_value
--   from public.phase94_backfill_log l
--  where l.table_name = 'tour_guides' and l.row_id = g.id
--    and g.company_name is not distinct from l.new_value;
--
-- commit;
