-- ============================================================
-- phase137 — featured listings get a position, not just a flag.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS CHANGES
--
-- `featured` already decides WHETHER a listing appears on the home
-- page. It says nothing about WHERE in the row, so every featured
-- listing has been ordered by rating — which means an admin who wants
-- a particular tour guide shown first has no way to say so.
--
-- featured_order is that position. 1 is first.
--
-- NULL means "no position given", and those sort AFTER every numbered
-- listing, still ahead of anything unfeatured. So this migration
-- changes nothing on the site until someone types a number: every
-- existing featured listing keeps its current rating-based order.
-- That is why there is no backfill — a generated position would be a
-- decision nobody made, dressed up as one.
--
-- ---------------------------------------------------------------------------
-- WHY A LOOP AND NOT SIXTEEN ALTER STATEMENTS
--
-- Rego has no single listings table; `featured` lives on each listing
-- table separately, and which tables have it has drifted — tour_guides
-- got theirs from an ALTER in phase19, not from its CREATE. Writing
-- the list by hand would mean guessing, and a table quietly missed
-- would show up much later as one home page row that ignores its
-- ordering for no visible reason.
--
-- So this asks the database which tables actually have `featured` and
-- adds the column to exactly those. A table that does not exist here,
-- or has no featured flag, is skipped and reported rather than failing
-- the migration.
-- ---------------------------------------------------------------------------

-- ============================================================
-- 0. TABLES THAT COULD NOT BE FEATURED AT ALL
--
-- tour_packages and transports appear on the home page — "Trending
-- Tour Packages" and the transport row — but neither table ever had a
-- `featured` column, so there was no way to pick one out. A position
-- is meaningless without the flag it orders, so the flag comes first.
--
-- Additive and default false: every existing package and vehicle keeps
-- behaving exactly as it does today until an admin ticks one.
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['tour_packages', 'transports'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip %: table not present', t;
      continue;
    end if;
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'featured'
    ) then
      continue;
    end if;
    execute format(
      'alter table public.%I add column featured boolean not null default false', t
    );
    execute format(
      'create index if not exists %I on public.%I (featured) where featured',
      t || '_featured_idx', t
    );
    raise notice 'added featured to %', t;
  end loop;
end $$;


do $$
declare
  t           text;
  n_added     int := 0;
  n_present   int := 0;
  n_skipped   int := 0;
  candidates  text[] := array[
    'hotels','homestays','hostels','tour_companies','tour_packages',
    'tour_guides','transports','transport_services','transport_providers',
    'rental_vehicles','rental_items','media_providers','restaurants',
    'activities','coworking_spaces','expedition_companies',
    'expedition_professionals','roadside_providers',
    /* Also home page rows that already honour `featured`: the events
       band, the Safarnama stories row and the solo-traveller row. They
       are not "listings" in the marketplace sense, which is exactly why
       they were easy to forget — and forgetting one means that single
       row ignores its ordering with nothing on screen to explain why. */
    'events','stories','solo_travelers'
  ];
begin
  foreach t in array candidates loop
    -- Not in this database at all.
    if to_regclass('public.' || t) is null then
      n_skipped := n_skipped + 1;
      raise notice 'skip %: table not present', t;
      continue;
    end if;

    -- Has no featured flag, so a position would order nothing.
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'featured'
    ) then
      n_skipped := n_skipped + 1;
      raise notice 'skip %: no featured column', t;
      continue;
    end if;

    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'featured_order'
    ) then
      n_present := n_present + 1;
      continue;
    end if;

    execute format(
      'alter table public.%I add column featured_order int', t
    );

    /* A position must be a position. Zero and negatives sort ahead of 1
       and read as "off", which is what the featured flag is for. */
    execute format(
      'alter table public.%I add constraint %I check (featured_order is null or featured_order > 0)',
      t, t || '_featured_order_positive'
    );

    execute format(
      'comment on column public.%I.featured_order is %L',
      t,
      'Position within the featured row on the home page. 1 is first. NULL = unpositioned, sorts after every numbered listing.'
    );

    /* Partial: only featured rows are ever ordered by this, and they are
       a small slice of each table. Indexing the rest would cost writes
       for reads that never happen. */
    execute format(
      'create index if not exists %I on public.%I (featured_order) where featured',
      t || '_featured_order_idx', t
    );

    n_added := n_added + 1;
  end loop;

  raise notice 'featured_order: % added, % already present, % skipped',
    n_added, n_present, n_skipped;
end $$;


-- ============================================================
-- VERIFY — which tables can now be ordered
-- ============================================================
select
  c.table_name,
  (select count(*) from information_schema.columns c2
    where c2.table_schema = 'public' and c2.table_name = c.table_name
      and c2.column_name = 'featured_order') > 0 as has_order
from information_schema.columns c
where c.table_schema = 'public'
  and c.column_name = 'featured'
order by c.table_name;


-- ============================================================
-- HOW THE SORT WORKS
--
-- The application orders a home page row as:
--
--   featured first,
--   then featured_order ascending with NULLs last,
--   then rating descending.
--
-- In SQL that is:
--
--   order by featured desc,
--            featured_order asc nulls last,
--            rating desc
--
-- Two listings given the same number fall back to rating between
-- themselves. Nothing stops an admin using 1, 1, 1 — it just means
-- "these three first, sorted as before".
-- ============================================================


-- ============================================================
-- ROLLBACK
--
-- Removes the positions and leaves every featured flag untouched, so
-- the home page returns to rating order.
--
--   do $$
--   declare t text;
--   begin
--     for t in
--       select table_name from information_schema.columns
--        where table_schema = 'public' and column_name = 'featured_order'
--     loop
--       execute format('drop index if exists public.%I', t || '_featured_order_idx');
--       execute format('alter table public.%I drop column if exists featured_order', t);
--     end loop;
--   end $$;
-- ============================================================
