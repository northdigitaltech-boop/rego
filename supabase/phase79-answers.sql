-- ============================================================================
-- Phase 79 — Answer Engine Optimization: the answer store (Phase 2)
--
-- ADDITIVE AND IDEMPOTENT. Safe to re-run. Changes NO existing behaviour.
-- Every existing page keeps working with zero answer rows.
--
-- ---------------------------------------------------------------------------
-- WHY A NEW TABLE RATHER THAN REUSING location_seo.faq
--
-- phase72 already stores FAQs as `location_seo.faq jsonb` — an array of
-- {q, a}. That is the right shape for a few lines of SEO copy and it stays
-- exactly as it is. It cannot carry what an ANSWER needs:
--
--     • a review workflow (draft → review → published)
--     • an expiry date, so a road condition stops being presented as current
--     • a source reference, so a factual claim can be checked
--     • a last-verified timestamp
--     • an audit trail of who published what
--     • an answer type and traveller intent, for organisation
--
-- Putting those inside a jsonb blob would mean no constraints, no indexes,
-- no RLS on individual answers, and no way to query "what expired today".
-- So: the jsonb stays for simple page copy; this table is the governed
-- answer system. The public FAQ component prefers governed answers and falls
-- back to the jsonb, so nothing breaks and nothing is migrated by force.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DELIBERATELY DOES NOT DO
--   • No answer is ever published automatically. `status` defaults to 'draft'.
--   • Road and weather data is NOT copied here. public.road_updates remains
--     the source of truth; an answer may point at it, never duplicate it.
--   • No AI generation, no bulk seeding, no sample content.
--
-- PREREQUISITES: phase29 (is_admin), phase72 (locations, service_categories)
-- ROLLBACK: bottom of file.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() missing — run phase29-auth-profiles.sql first.';
  end if;
  if to_regclass('public.locations') is null then
    raise exception 'public.locations missing — run phase72-market-areas.sql first.';
  end if;
end $$;


-- ============================================================================
-- 1. THE ANSWERS TABLE
-- ============================================================================
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),

  /* ---- The answer itself ---- */
  question        text not null,
  -- The one paragraph that answers the question on its own. This is what a
  -- traveller reads first and what an answer engine is most likely to lift.
  short_answer    text not null,
  -- Optional supporting explanation. Never required to understand the short
  -- answer — if it is, the short answer is wrong.
  detailed_answer text,

  /* ---- Classification ---- */
  -- general | best_time | how_to_reach | distance | travel_duration |
  -- estimated_cost | accommodation | transport | tour_guide | activities |
  -- safety | weather | road_status | booking | cancellation |
  -- provider_verification | service_availability
  answer_type text not null default 'general',

  -- Traveller intent, for organisation and analysis only. It must never
  -- become a URL or a hidden keyword page.
  -- discover | plan | compare | book | travel | stay | explore | safety | support
  intent text,

  /* ---- What this answer is about ----
     Free-text entity_type + entity_id keeps this open to listing types that
     have no foreign key here (hotels, tours, guides…). location_id and
     service_slug ARE foreign keys, because those drive availability logic
     and a dangling reference there would produce a wrong answer. */
  entity_type text,               -- destination | listing | service | site
  entity_id   uuid,

  market_id   uuid references public.markets(id)   on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  service_slug text references public.service_categories(slug) on update cascade,

  language_code text not null default 'en',

  /* ---- Trust ----
     source_references is an array of {label, url}. A factual claim a reader
     cannot check is an assertion, and assertions are what make an answer
     engine stop trusting a domain. */
  source_references jsonb not null default '[]'::jsonb,

  is_time_sensitive boolean not null default false,
  valid_from   timestamptz,
  valid_until  timestamptz,
  last_verified_at timestamptz,

  /* ---- Workflow ---- */
  -- draft | review | published | needs_review | expired | archived
  status text not null default 'draft',

  display_order int not null default 100,
  is_featured   boolean not null default false,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint answers_status_valid check (status in
    ('draft','review','published','needs_review','expired','archived')),

  constraint answers_type_valid check (answer_type in
    ('general','best_time','how_to_reach','distance','travel_duration',
     'estimated_cost','accommodation','transport','tour_guide','activities',
     'safety','weather','road_status','booking','cancellation',
     'provider_verification','service_availability')),

  constraint answers_intent_valid check (intent is null or intent in
    ('discover','plan','compare','book','travel','stay','explore','safety','support')),

  constraint answers_entity_type_valid check (entity_type is null or entity_type in
    ('destination','listing','service','site')),

  constraint answers_question_not_blank check (btrim(question) <> ''),
  constraint answers_short_answer_not_blank check (btrim(short_answer) <> ''),
  constraint answers_sources_is_array check (jsonb_typeof(source_references) = 'array'),
  constraint answers_valid_window check (valid_until is null or valid_from is null or valid_until > valid_from),

  /* A time-sensitive answer with no expiry is how stale road conditions end
     up presented as current a year later. Enforced in the database, not just
     in the form, because the form is not the only way rows get written. */
  constraint answers_time_sensitive_needs_expiry
    check (not is_time_sensitive or valid_until is not null)
);

/* One question per entity per language. Prevents two admins publishing
   competing answers to the same question, which is worse than none. */
create unique index if not exists answers_unique_question
  on public.answers (
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(service_slug, ''),
    coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    language_code,
    lower(btrim(question))
  )
  where status <> 'archived';

create index if not exists answers_location_idx on public.answers (location_id) where status = 'published';
create index if not exists answers_service_idx  on public.answers (service_slug) where status = 'published';
create index if not exists answers_entity_idx   on public.answers (entity_type, entity_id);
create index if not exists answers_status_idx   on public.answers (status);
create index if not exists answers_expiry_idx   on public.answers (valid_until)
  where valid_until is not null and status = 'published';
create index if not exists answers_lang_idx     on public.answers (language_code);


-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.answers_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists answers_touch_trg on public.answers;
create trigger answers_touch_trg before update on public.answers
  for each row execute function public.answers_touch();


-- ============================================================================
-- 2. AUDIT LOG — append-only
--
-- Separate from market_audit_logs so answer history can be read without
-- granting sight of area/market changes, and so this table can be retained
-- on a different schedule.
--
-- NO insert/update/delete policy is defined. Under RLS that means nobody
-- can write or alter rows with the anon key, including admins. The server
-- writes with the service-role key. That is what makes it evidence.
-- ============================================================================
create table if not exists public.answer_audit_logs (
  id uuid primary key default gen_random_uuid(),
  answer_id   uuid,
  actor_id    uuid,
  actor_email text,
  -- created | updated | submitted | published | unpublished | expired | archived
  action      text not null,
  before_value jsonb,
  after_value  jsonb,
  request_id  text,
  created_at  timestamptz not null default now()
);

create index if not exists answer_audit_answer_idx  on public.answer_audit_logs (answer_id);
create index if not exists answer_audit_created_idx on public.answer_audit_logs (created_at desc);


-- ============================================================================
-- 3. EXPIRY
--
-- A published answer whose window has passed must stop being presented as
-- current. It is moved to 'needs_review' rather than deleted — the content is
-- usually still 90% right and a human should update it, not rewrite it.
--
-- Called by the read layer and by the admin screen. Safe to call often.
-- ============================================================================
create or replace function public.expire_stale_answers()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n int;
begin
  update public.answers
     set status = 'needs_review', updated_at = now()
   where status = 'published'
     and valid_until is not null
     and valid_until < now();
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.expire_stale_answers() from public;
grant execute on function public.expire_stale_answers() to authenticated;


-- ============================================================================
-- 4. PUBLIC READ FUNCTION
--
-- The ONLY way public pages read answers. A plain select would let a
-- mis-written client query return drafts, and the moment that happens the
-- workflow is decorative.
--
-- Guarantees, enforced here rather than in the caller:
--   • status = 'published' only
--   • inside its validity window
--   • only for locations that are active and public
--   • never returns internal columns (created_by, updated_by, status)
-- ============================================================================
create or replace function public.get_published_answers(
  p_location_id uuid default null,
  p_service     text default null,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_language    text default 'en',
  p_limit       int  default 20
)
returns table (
  id uuid,
  question text,
  short_answer text,
  detailed_answer text,
  answer_type text,
  intent text,
  source_references jsonb,
  is_time_sensitive boolean,
  last_verified_at timestamptz,
  valid_until timestamptz,
  is_featured boolean,
  display_order int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    a.id, a.question, a.short_answer, a.detailed_answer,
    a.answer_type, a.intent, a.source_references,
    a.is_time_sensitive, a.last_verified_at, a.valid_until,
    a.is_featured, a.display_order
  from public.answers a
  where a.status = 'published'
    and a.language_code = coalesce(p_language, 'en')
    and (a.valid_from  is null or a.valid_from  <= now())
    and (a.valid_until is null or a.valid_until >  now())
    and (p_location_id is null or a.location_id = p_location_id)
    and (p_service     is null or a.service_slug = p_service)
    and (p_entity_type is null or a.entity_type = p_entity_type)
    and (p_entity_id   is null or a.entity_id = p_entity_id)
    /* An answer attached to a hidden or inactive area must not appear.
       Without this, disabling an area would leave its answers claiming
       services are available there. */
    and (
      a.location_id is null
      or exists (
        select 1 from public.locations l
         where l.id = a.location_id
           and public.resolve_location_flag(l.id, 'is_active')
           and public.resolve_location_flag(l.id, 'is_public')
      )
    )
    /* A service-specific answer must not outlive the service being switched
       off in that area. */
    and (
      a.service_slug is null
      or a.location_id is null
      or public.resolve_location_flag(a.location_id, 'listings_enabled', a.service_slug)
    )
  order by a.is_featured desc, a.display_order, a.created_at
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke all on function public.get_published_answers(uuid, text, text, uuid, text, int) from public;
grant execute on function public.get_published_answers(uuid, text, text, uuid, text, int) to anon, authenticated;

comment on function public.get_published_answers is
  'The only public read path for answers. Filters to published, in-window, and attached to an active public area. Never returns drafts or internal columns.';


-- ============================================================================
-- 5. APPROVED LISTING COUNTS
--
-- For factual marketplace statements like "12 approved hotels in Skardu".
--
-- Counts APPROVED and PUBLIC rows only. A count that includes pending or
-- rejected listings is a false claim, and the whole point of these sentences
-- is that they are checkable.
--
-- Returns the count AND the table it came from so the caller can decide
-- whether the dataset is large enough to quote a number at all.
-- ============================================================================
create or replace function public.approved_listing_count(
  p_location_id uuid,
  p_service text default null
)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  ids uuid[];
  tables text[];
  t text;
  total int := 0;
  n int;
begin
  if p_location_id is null then return 0; end if;

  select array_agg(id) into ids
    from public.locations
   where id = p_location_id or p_location_id = any(ancestors);
  if ids is null then return 0; end if;

  tables := case p_service
    when 'hotels'           then array['hotels']
    when 'homestays'        then array['homestays']
    when 'hostels'          then array['hostels']
    when 'restaurants'      then array['restaurants']
    when 'activities'       then array['activities']
    when 'guides'           then array['tour_guides']
    when 'transport'        then array['transport_providers']
    when 'photographers'    then array['media_providers']
    when 'coworking'        then array['coworking_spaces']
    when 'travel-companies' then array['tour_companies']
    else array['hotels','homestays','hostels','restaurants','activities',
               'tour_companies','tour_guides','transport_providers',
               'media_providers','coworking_spaces']
  end;

  foreach t in array tables loop
    if to_regclass('public.' || t) is null then continue; end if;
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name=t and column_name='location_id')
    then continue; end if;

    if exists (select 1 from information_schema.columns
                where table_schema='public' and table_name=t and column_name='status') then
      execute format(
        'select count(*) from public.%I where location_id = any($1) and status = ''approved''', t)
        into n using ids;
    else
      execute format('select count(*) from public.%I where location_id = any($1)', t)
        into n using ids;
    end if;
    total := total + coalesce(n, 0);
  end loop;

  return total;
end $$;

revoke all on function public.approved_listing_count(uuid, text) from public;
grant execute on function public.approved_listing_count(uuid, text) to anon, authenticated;


-- ============================================================================
-- 6. RLS
--
-- Public reads go through get_published_answers() (security definer), so the
-- table itself needs NO public select policy at all. Anonymous users cannot
-- read the table directly — which means a draft cannot leak through a
-- hand-written client query.
-- ============================================================================
alter table public.answers           enable row level security;
alter table public.answer_audit_logs enable row level security;

drop policy if exists answers_admin_read on public.answers;
create policy answers_admin_read on public.answers
  for select using (public.is_admin());

drop policy if exists answers_admin_write on public.answers;
create policy answers_admin_write on public.answers
  for all using (public.is_admin()) with check (public.is_admin());

-- Deliberately NO policy for anon. Reads happen only via the function above.

drop policy if exists answer_audit_admin_read on public.answer_audit_logs;
create policy answer_audit_admin_read on public.answer_audit_logs
  for select using (public.is_admin());
-- No write policy: append-only, service-role writes only.


-- ============================================================================
-- 7. VERIFY
-- ============================================================================
do $$
declare n_ans int; n_pub int;
begin
  select count(*) into n_ans from public.answers;
  select count(*) into n_pub from public.answers where status = 'published';

  raise notice '--------------------------------------------';
  raise notice 'Phase 79 complete.';
  raise notice '  answers          : %', n_ans;
  raise notice '  published        : %  (must be 0 — nothing is seeded)', n_pub;
  raise notice '';
  raise notice 'No answer content is created by this migration.';
  raise notice 'Every answer must be written and published by a human.';
  raise notice '--------------------------------------------';

  if n_pub > 0 then
    raise warning 'Published answers already exist. This migration seeds none.';
  end if;
end $$;


-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
drop function if exists public.approved_listing_count(uuid, text);
drop function if exists public.get_published_answers(uuid, text, text, uuid, text, int);
drop function if exists public.expire_stale_answers();
drop trigger  if exists answers_touch_trg on public.answers;
drop function if exists public.answers_touch();
drop table    if exists public.answer_audit_logs;
drop table    if exists public.answers;   -- WARNING: destroys written answers
*/
