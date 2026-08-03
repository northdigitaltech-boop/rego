-- ============================================================
-- Phase 65 — Tourist attractions per destination
--
-- Adds an `attractions` JSON array to each destination so the admin can
-- list the spots travellers should see there. Each entry looks like:
--
--   { "name": "Attabad Lake",
--     "type": "Lake",
--     "blurb": "Bright blue lake formed by the 2010 landslide.",
--     "image": "https://…" }
--
-- Stored as JSONB on the existing row: no new table, no new policies,
-- and the destination page keeps loading in a single query.
-- ============================================================

alter table if exists public.destinations
  add column if not exists attractions jsonb not null default '[]'::jsonb;

comment on column public.destinations.attractions is
  'Ordered list of tourist spots shown on the destination page. Array of {name,type,blurb,image}.';

-- Guard against a non-array value being written by mistake.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'destinations_attractions_is_array'
  ) then
    alter table public.destinations
      add constraint destinations_attractions_is_array
      check (jsonb_typeof(attractions) = 'array');
  end if;
end $$;
