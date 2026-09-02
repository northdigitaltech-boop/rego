/* ============================================================
 * phase95 — the location column phase72 meant to add and didn't
 *
 * THE BUG
 *   phase72 adds location_id and market_id to every listing table
 *   by looping over a list of names. The list contains
 *   'expedition_pros'. The table is called
 *   expedition_professionals.
 *
 *   The loop is written defensively:
 *
 *       if to_regclass('public.' || t) is not null then
 *
 *   so a name that does not exist is skipped rather than raising.
 *   That guard is what made the typo silent: phase72 reported
 *   success, and one table quietly never got the columns. It has
 *   been missing ever since, through phase74, 75, 76, 77 and 81 —
 *   none of which touch that table either, so nothing complained.
 *
 *   Guards that swallow a typo are worth noticing. This one hid a
 *   mistake for six migrations.
 *
 * WHAT THIS DOES
 *   Adds the two columns, with the same shape phase72 gives every
 *   other listing table: nullable, no default, no backfill, no
 *   constraint. Every existing row keeps working untouched, and
 *   every existing query keeps working, because nothing selects a
 *   column it does not know about.
 *
 * WHY IT MATTERS NOW
 *   The registration wizard for individual expedition
 *   professionals — porters, cooks, high-altitude guides — cannot
 *   record a structured area until this exists. That branch is
 *   deliberately left unwired in the code until this has run, so
 *   the deploy order cannot break a porter's ability to register.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
begin
  if to_regclass('public.expedition_professionals') is null then
    raise exception
      'public.expedition_professionals is missing — this database is not the one phase20 built.';
  end if;
end $$;

alter table public.expedition_professionals
  add column if not exists location_id uuid;
alter table public.expedition_professionals
  add column if not exists market_id uuid;

/* Partial, matching phase72: the index covers only rows that have been given
   a location, so it stays small while most rows still have none. */
create index if not exists expedition_professionals_location_id_idx
  on public.expedition_professionals (location_id)
  where location_id is not null;


/* Confirm. The Supabase editor shows only the last result set, so this is
   deliberately the last statement. */
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'expedition_professionals'
  and column_name in ('location_id', 'market_id')
order by column_name;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * Safe only while nothing has been written to these columns. Check
 * first — the count below must be 0:
 *
 *   select count(*) from public.expedition_professionals
 *    where location_id is not null or market_id is not null;
 * ------------------------------------------------------------------ */
-- drop index if exists public.expedition_professionals_location_id_idx;
-- alter table public.expedition_professionals drop column if exists market_id;
-- alter table public.expedition_professionals drop column if exists location_id;
