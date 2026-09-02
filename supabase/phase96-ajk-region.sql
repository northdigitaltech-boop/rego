/* ============================================================
 * phase96 — Azad Jammu & Kashmir, stored and hidden
 *
 * ADDITIVE AND IDEMPOTENT. Safe to re-run. Nothing becomes
 * public, on the public site or anywhere else.
 *
 * WHY
 *   The brief asks for three regions to exist in the data —
 *   Gilgit-Baltistan, Khyber Pakhtunkhwa, Azad Jammu & Kashmir —
 *   with only the first one public. Two of the three already
 *   exist: phase74 seeded GB properly, and KPK because Naran and
 *   Kaghan needed a factually correct parent. AJK was never
 *   added.
 *
 * WHY IT STAYS HIDDEN WITHOUT A SINGLE FLAG BEING SET
 *   Every visibility flag is left NULL, and NULL means inherit.
 *   Pakistan, the country row above it, has no explicit
 *   is_public either, so nothing resolves to public. Separately —
 *   and this is the part that actually protects it — the
 *   row-level security read policy is:
 *
 *       using (is_public is true and is_active is not false)
 *
 *   That reads the row's OWN column and does not inherit, so an
 *   undecided location cannot be read by a traveller at all. AJK
 *   is invisible by the same rule that already hides KPK, not by
 *   anything special written for it.
 *
 * WHY ONLY THE REGION
 *   The brief is explicit: do not seed thousands of locations,
 *   create the architecture and let the admin add them. AJK's
 *   districts are the admin's to add, in the tab, when there is a
 *   reason to. Seeding a hierarchy nobody has checked is how
 *   phase74 came to exist in the first place.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
declare
  m_pk uuid;
  l_pk uuid;
  l_ajk uuid;
begin
  if to_regprocedure('public.upsert_location(uuid,uuid,text,text,text,double precision,double precision,int)') is null then
    raise exception 'public.upsert_location is missing — run phase74-gb-geography.sql first.';
  end if;

  select id into m_pk from public.markets where slug = 'pakistan';
  if m_pk is null then
    raise exception 'market "pakistan" is missing — run phase72-market-areas.sql first.';
  end if;

  select id into l_pk from public.locations
   where market_id = m_pk and slug = 'pakistan' and parent_id is null;
  if l_pk is null then
    raise exception 'the Pakistan country location is missing — run phase72 first.';
  end if;

  /* display_order 3: Gilgit-Baltistan is 1 and Khyber Pakhtunkhwa is 2.
     Coordinates are Muzaffarabad, the capital — a region has no single point,
     so this is the conventional one rather than a computed centroid. */
  l_ajk := public.upsert_location(
    m_pk, l_pk, 'region', 'Azad Jammu & Kashmir', 'azad-jammu-kashmir',
    34.3700, 73.4711, 3
  );

  /* Belt and braces. upsert_location only fills blanks, so it would not have
     set these anyway — but an explicit NULL states the intent for anyone
     reading the row later: undecided, not "decided to hide". */
  update public.locations
     set is_active                = null,
         is_public                = null,
         onboarding_enabled       = null,
         listings_enabled         = null,
         booking_enabled          = null,
         manual_approval_required = null,
         coming_soon              = null,
         is_featured              = null,
         seo_enabled              = null
   where id = l_ajk
     and is_public is null;   -- never overwrite a decision already taken
end $$;


/* What the admin will now see under Pakistan, and what a traveller can read.
   `readable_by_public` uses the RLS rule verbatim rather than the inherited
   resolution, because that is what actually decides the answer.
   The Supabase editor shows only the last result set, so this is last. */
select
  l.name,
  l.location_type,
  l.display_order,
  l.is_public                                         as is_public_column,
  (l.is_public is true and l.is_active is not false)   as readable_by_public
from public.locations l
join public.locations p on p.id = l.parent_id
where p.slug = 'pakistan'
  and l.location_type = 'region'
order by l.display_order;


/* ------------------------------------------------------------------
 * ROLLBACK
 *
 * Safe only while nothing has been attached to it. Check first —
 * both counts must be 0:
 *
 *   select count(*) from public.locations
 *    where parent_id = (select id from public.locations
 *                        where slug = 'azad-jammu-kashmir');
 *
 *   select count(*) from public.hotels
 *    where location_id = (select id from public.locations
 *                          where slug = 'azad-jammu-kashmir');
 *
 * locations.parent_id is ON DELETE RESTRICT, so a child would stop
 * the delete rather than orphan itself. That is the safety net, not
 * the plan.
 * ------------------------------------------------------------------ */
-- delete from public.locations where slug = 'azad-jammu-kashmir';
