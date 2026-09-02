/* ============================================================
 * phase100 — put every Gilgit-Baltistan district under its division
 *
 * IDEMPOTENT. Safe to re-run. Deletes nothing. Moves rows, adds
 * the districts that were missing, and changes no listing.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS WRONG
 *
 * The provider form shows divisions and districts on the same dropdown:
 *
 *     Gilgit Division      <- division
 *     Skardu               <- district, should be inside Baltistan Division
 *     Baltistan Division   <- division
 *     Gilgit               <- district
 *     ...
 *
 * They are siblings because the districts still have parent_id pointing at
 * Gilgit-Baltistan itself. phase72 seeded them that way as a placeholder;
 * phase74 was written to insert the three divisions and move the districts
 * underneath them, and upsert_location does re-parent rather than duplicate.
 *
 * The divisions exist, so phase74 ran. The districts did not move, so either
 * it did not finish or its rollback — which sets parent_id back to
 * Gilgit-Baltistan for exactly these rows — was run afterwards.
 *
 * Rather than work out which, this states the intended shape and asserts it.
 * Running it when everything is already correct changes nothing.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS SAFE FOR EXISTING LISTINGS
 *
 * A listing points at a district by its id. Moving that district changes its
 * parent_id, not its id, so every hotel, tour and booking attached to Skardu
 * stays attached to Skardu.
 *
 * The towns and areas INSIDE each district are handled too, and not by this
 * file: phase72 ships locations_rebuild_subtree, which re-saves every
 * descendant when a node's depth or path changes, ordered by depth so a parent
 * is always rebuilt before its children. Its comment names this exact case —
 * "moving Skardu under a new division would silently leave every town beneath
 * it with a stale path". So Shangrila's path becomes
 * pakistan / gilgit-baltistan / baltistan-division / skardu / shangrila
 * without this migration mentioning Shangrila at all.
 *
 * ---------------------------------------------------------------------------
 * THE STRUCTURE, AS CONFIRMED
 *
 *   Baltistan Division  Skardu, Shigar, Kharmang, Ghanche, Roundu
 *   Gilgit Division     Gilgit, Hunza, Nagar, Ghizer, Gupis-Yasin
 *   Diamer Division     Diamer, Astore, Darel, Tangir
 *
 * Gupis-Yasin sits in Gilgit Division. It was listed under Diamer in the
 * request; it was carved out of Ghizer, which is Gilgit Division, and that
 * was confirmed before this file was written. Recording the disagreement
 * here because a wrong parent is invisible once it is saved.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
declare
  m_pk uuid;
  l_gb uuid;
  d_bal uuid; d_gil uuid; d_dia uuid;
  moved int := 0;
  created int := 0;

  /* district slug -> division slug */
  pairs text[][] := array[
    ['skardu',      'baltistan-division'],
    ['shigar',      'baltistan-division'],
    ['kharmang',    'baltistan-division'],
    ['ghanche',     'baltistan-division'],
    ['roundu',      'baltistan-division'],
    ['gilgit',      'gilgit-division'],
    ['hunza',       'gilgit-division'],
    ['nagar',       'gilgit-division'],
    ['ghizer',      'gilgit-division'],
    ['gupis-yasin', 'gilgit-division'],
    ['diamer',      'diamer-division'],
    ['astore',      'diamer-division'],
    ['darel',       'diamer-division'],
    ['tangir',      'diamer-division']
  ];
  names text[] := array[
    'Skardu','Shigar','Kharmang','Ghanche','Roundu',
    'Gilgit','Hunza','Nagar','Ghizer','Gupis-Yasin',
    'Diamer','Astore','Darel','Tangir'
  ];
  i int;
  d_slug text; div_slug text; d_name text;
  div_id uuid; existing_id uuid; existing_parent uuid;
begin
  select id into m_pk from public.markets where slug = 'pakistan';
  if m_pk is null then
    raise exception 'market "pakistan" is missing — run phase72-market-areas.sql first.';
  end if;

  select id into l_gb from public.locations
   where market_id = m_pk and slug = 'gilgit-baltistan';
  if l_gb is null then
    raise exception 'Gilgit-Baltistan is missing — run phase74-gb-geography.sql first.';
  end if;

  /* The divisions. upsert_location moves rather than duplicates, so this is
     safe whether they exist or not. */
  d_gil := public.upsert_location(m_pk, l_gb, 'division', 'Gilgit Division',    'gilgit-division',    35.92, 74.31, 1);
  d_bal := public.upsert_location(m_pk, l_gb, 'division', 'Baltistan Division', 'baltistan-division', 35.30, 75.63, 2);
  d_dia := public.upsert_location(m_pk, l_gb, 'division', 'Diamer Division',    'diamer-division',    35.42, 74.10, 3);

  for i in 1 .. array_length(pairs, 1) loop
    d_slug   := pairs[i][1];
    div_slug := pairs[i][2];
    d_name   := names[i];

    div_id := case div_slug
                when 'gilgit-division'    then d_gil
                when 'baltistan-division' then d_bal
                when 'diamer-division'    then d_dia
              end;

    select id, parent_id into existing_id, existing_parent
      from public.locations
     where market_id = m_pk
       and slug = d_slug
       and location_type = 'district'
     order by created_at
     limit 1;

    if existing_id is null then
      /* A district that was never seeded — Darel and Tangir, most likely.
         No coordinates: an invented point on a map is worse than none, and
         the admin can add the real one. */
      perform public.upsert_location(m_pk, div_id, 'district', d_name, d_slug, null, null, i);
      created := created + 1;

    elsif existing_parent is distinct from div_id then
      /* Move it. The id does not change, so every listing pointing at this
         district follows it. */
      update public.locations
         set parent_id = div_id,
             updated_at = now()
       where id = existing_id;
      moved := moved + 1;
    end if;
  end loop;

  raise notice 'phase100: moved %, created %', moved, created;
end $$;


/* The shape you should now see. Anything with a blank division is still
   sitting directly under the region and needs looking at.
   The Supabase editor shows only the last result set, so this is last. */
select
  coalesce(div.name, '(directly under the region)') as division,
  l.name                                            as district,
  l.location_type,
  (select count(*) from public.locations c where c.parent_id = l.id) as places_inside
from public.locations l
left join public.locations div
       on div.id = l.parent_id and div.location_type = 'division'
join public.locations reg
       on reg.id = coalesce(div.parent_id, l.parent_id)
where reg.slug = 'gilgit-baltistan'
  and l.location_type = 'district'
order by division, l.name;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * Puts the districts back directly under Gilgit-Baltistan, which is
 * where phase72 left them. It does NOT delete Darel, Tangir or
 * Gupis-Yasin if this file created them — deleting a location that a
 * provider may already have chosen is not something an undo should do
 * quietly, and ON DELETE RESTRICT would stop it anyway.
 * ------------------------------------------------------------------ */
-- update public.locations
--    set parent_id = (select id from public.locations
--                      where slug = 'gilgit-baltistan'
--                        and market_id = (select id from public.markets where slug = 'pakistan'))
--  where location_type = 'district'
--    and parent_id in (
--      select id from public.locations
--       where location_type = 'division'
--         and slug in ('gilgit-division','baltistan-division','diamer-division')
--    );
