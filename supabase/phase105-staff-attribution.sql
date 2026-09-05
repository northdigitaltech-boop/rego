/* ============================================================
 * phase105 — team phase 4: who brought this provider
 *
 * ADDITIVE AND IDEMPOTENT. Safe to re-run. Existing listings get
 * no attribution and must not be given any.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS ONE IS URGENT AND THE ANALYTICS ARE NOT
 *
 * Every other part of the team brief can be built later without losing
 * anything. This cannot. A provider who registers next week with no referral
 * record is permanently unattributable — there is no log to reconstruct it
 * from, and asking a marketing executive in March which of forty hotels they
 * brought in January is asking them to guess.
 *
 * So this ships before the dashboards that read it.
 *
 * ---------------------------------------------------------------------------
 * SIX ROLES, NOT ONE created_by
 *
 * The brief is right that these are different questions:
 *
 *   referred                  — who brought them to Rego at all
 *   created                   — who typed the listing in
 *   assisted                  — who helped them do it
 *   reviewed                  — who checked it
 *   verification_recommended  — who put it forward for verification
 *   base                      — reserved; the provider's own place
 *
 * A single created_by collapses all of them, and then "who should be credited
 * for this hotel" has no answer. Six rows in one table answer it separately
 * and keep answering after a second person gets involved.
 *
 * ---------------------------------------------------------------------------
 * REFERRAL IS FIRST-TOUCH AND IMMUTABLE
 *
 * Once a listing has a `referred` row it cannot be replaced — not by an edit,
 * not by a later reviewer, not by a second referral code. §33 of the brief
 * asks for this and it is also the only defensible rule: whoever actually
 * brought the provider did that once, and every later touch is a different
 * relation with its own row.
 *
 * ROLLBACK: at the bottom.
 * ============================================================ */

do $$
begin
  if to_regclass('public.staff_members') is null then
    raise exception 'public.staff_members is missing — run phase104-staff-foundation.sql first.';
  end if;
  if to_regprocedure('public.owns_listing(text, uuid)') is null then
    raise exception 'public.owns_listing is missing — run phase99-service-locations.sql first.';
  end if;
end $$;


create table if not exists public.staff_attributions (
  id uuid primary key default gen_random_uuid(),

  /* Same shape as service_locations: eighteen listing tables, no polymorphic
     foreign key in Postgres, so the table name is a column and is
     allowlisted. The cost is that listing_id cannot be enforced; an orphan
     row joins to nothing and is inert. */
  listing_table text not null,
  listing_id    uuid not null,

  staff_id uuid not null references public.staff_members(id) on delete restrict,

  relation text not null,

  /* How it happened, for telling a link click apart from a typed code apart
     from an admin correcting the record months later. */
  source text not null default 'manual',

  note       text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),

  constraint staff_attributions_table_known check (listing_table in (
    'hotels','homestays','hostels',
    'tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles',
    'media_providers','media_services',
    'restaurants','activities','events','coworking_spaces',
    'roadside_providers','expedition_companies','expedition_professionals'
  )),

  constraint staff_attributions_relation_known check (relation in (
    'referred','created','assisted','reviewed','verification_recommended','base'
  )),

  constraint staff_attributions_source_known check (source in (
    'referral_link','referral_code','team_portal','manual','import'
  )),

  /* One row per person per role per listing. Two people can both have
     assisted; one person cannot have assisted twice. */
  constraint staff_attributions_unique
    unique (listing_table, listing_id, staff_id, relation)
);

/* ONE referral per listing, whoever it is. This is what makes first-touch
   real: a second code cannot be attached, so nobody can overwrite a
   colleague's referral by re-sending the link. */
create unique index if not exists staff_attributions_one_referral
  on public.staff_attributions (listing_table, listing_id)
  where relation = 'referred';

/* "What did this person bring in" — the query every analytic starts from. */
create index if not exists staff_attributions_staff_idx
  on public.staff_attributions (staff_id, relation);

/* "Who is behind this listing" — the listing page and the admin. */
create index if not exists staff_attributions_listing_idx
  on public.staff_attributions (listing_table, listing_id);


/* ============================================================
 * ROW LEVEL SECURITY
 *
 * Read: admins, and a staff member their own rows. NOT public —
 * "which employee brought this hotel" is internal, and a traveller
 * has no reason to see it.
 *
 * Write: NO INSERT POLICY AT ALL. Rows arrive through
 * attach_referral() below, which is security definer. A provider
 * form runs in a browser with the anon key; if it could write here
 * directly, a provider could credit anyone, including nobody's
 * favourite employee, and the performance numbers would be
 * fiction.
 * ============================================================ */
alter table public.staff_attributions enable row level security;

drop policy if exists staff_attributions_read on public.staff_attributions;
create policy staff_attributions_read on public.staff_attributions
  for select using (
    public.is_admin()
    or staff_id in (select id from public.staff_members where profile_id = auth.uid())
  );

/* Admins can correct the record — an import, or a referral someone genuinely
   earned that the link never captured. Every other write path is closed. */
drop policy if exists staff_attributions_admin_write on public.staff_attributions;
create policy staff_attributions_admin_write on public.staff_attributions
  for all using (public.is_admin()) with check (public.is_admin());


/* ============================================================
 * attach_referral() — the only way a provider form writes here
 *
 * Returns a WORD, not a boolean. "It did not work" is four
 * different situations and the caller should be able to say which:
 * a code that does not exist is a typo worth mentioning, a listing
 * that already has a referral is not an error at all.
 *
 *   attached      — written
 *   already       — this listing already has a referral; left alone
 *   unknown_code  — no such referral code
 *   inactive      — the member exists but is suspended or disabled
 *   not_yours     — the caller does not own that listing
 *   bad_table     — not a listing table
 * ============================================================ */
create or replace function public.attach_referral(
  p_table text,
  p_id    uuid,
  p_code  text,
  p_source text default 'referral_link'
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff_id uuid;
  v_status   text;
begin
  if p_table not in (
    'hotels','homestays','hostels',
    'tour_companies','tour_packages','tour_guides',
    'transport_providers','transport_services','rental_vehicles',
    'media_providers','media_services',
    'restaurants','activities','events','coworking_spaces',
    'roadside_providers','expedition_companies','expedition_professionals'
  ) then
    return 'bad_table';
  end if;

  /* The caller must own the listing they are attributing. Without this, any
     signed-in user could attach a referral to somebody else's hotel — and
     since referral is first-touch, that would permanently take the credit
     from whoever really earned it. */
  if not public.owns_listing(p_table, p_id) then
    return 'not_yours';
  end if;

  /* Resolved HERE, from the code, in the database. The browser sends a
     string; it never sends a staff id, because a staff id in a request body
     is a staff id anyone can change. */
  select id, status into v_staff_id, v_status
    from public.staff_members
   where upper(referral_code) = upper(trim(p_code));

  if v_staff_id is null then
    return 'unknown_code';
  end if;

  /* A suspended employee's link stops crediting them. If that is wrong for a
     given case, an admin can add the row by hand — which is a decision
     someone makes, not a link that keeps working after access is revoked. */
  if v_status <> 'active' then
    return 'inactive';
  end if;

  insert into public.staff_attributions (listing_table, listing_id, staff_id, relation, source)
  values (p_table, p_id, v_staff_id, 'referred',
          case when p_source in ('referral_link','referral_code','team_portal','manual','import')
               then p_source else 'referral_link' end)
  on conflict do nothing;

  /* on conflict do nothing covers both unique rules: the same person twice,
     and a different person on a listing that already has a referral. Either
     way the existing row stands. */
  if not found then
    return 'already';
  end if;

  return 'attached';
end $$;

comment on function public.attach_referral is
  'Attach a referral to a listing the caller owns. Resolves the code in the '
  'database, refuses if the listing already has one, and never accepts a '
  'staff id from the client.';

revoke all on function public.attach_referral(text, uuid, text, text) from public, anon;
grant execute on function public.attach_referral(text, uuid, text, text) to authenticated;


/* ============================================================
 * Who is behind a listing — for the admin and the provider's own
 * page. Returns names, so callers do not each write this join.
 * ============================================================ */
create or replace function public.listing_attribution(p_table text, p_id uuid)
returns table (
  relation      text,
  employee_code text,
  staff_name    text,
  department    text,
  source        text,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    a.relation,
    m.employee_code,
    coalesce(p.full_name, p.email),
    d.name,
    a.source,
    a.created_at
  from public.staff_attributions a
  join public.staff_members m      on m.id = a.staff_id
  join public.staff_departments d  on d.id = m.department_id
  left join public.profiles p      on p.id = m.profile_id
  where a.listing_table = p_table
    and a.listing_id = p_id
    /* Admins and the staff member themselves. Deliberately not the provider:
       who inside Rego is credited for their listing is not their business. */
    and (
      public.is_admin()
      or m.profile_id = auth.uid()
    )
  order by a.created_at;
$$;

revoke all on function public.listing_attribution(text, uuid) from public, anon;
grant execute on function public.listing_attribution(text, uuid) to authenticated;


/* Empty is correct — nothing writes here yet, and no existing listing is
   given attribution it did not earn.
   The Supabase editor shows only the last result set, so this is last. */
select
  (select count(*) from public.staff_attributions)                  as attributions,
  (select count(*) from public.staff_members where status='active') as active_staff,
  'Existing listings stay unattributed on purpose — see the brief, section 38'
                                                                    as note;


/* ------------------------------------------------------------------
 * ROLLBACK. Safe while nothing has been written; check first:
 *   select count(*) from public.staff_attributions;
 * ------------------------------------------------------------------ */
-- drop function if exists public.listing_attribution(text, uuid);
-- drop function if exists public.attach_referral(text, uuid, text, text);
-- drop table if exists public.staff_attributions;
