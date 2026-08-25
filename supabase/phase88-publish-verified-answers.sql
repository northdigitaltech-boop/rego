-- ============================================================================
-- phase88 — publish the Skardu answers that need no further verification
-- ============================================================================
--
-- WHY
--   phase80 seeded ten Skardu answers as drafts. Seven of them carry a
--   [VERIFY: ...] marker because they state something that has to be checked
--   against a real source before it goes on a public page — flight counts and
--   fares, Deosai's opening dates, permit rules for foreign nationals, driving
--   times. phase80's block_unverified_publish() trigger refuses to publish any
--   row that still contains one.
--
--   The remaining answers state nothing that can go stale or be wrong. Those
--   are the ones this migration publishes.
--
-- WHAT IT DOES NOT DO
--   It does not remove a single [VERIFY:] marker, and it does not publish a
--   row that has one. Filling those in is a research job for a person with a
--   source, not something a migration can do. Section 3 lists exactly what is
--   still needed for each.
--
-- NOTE ON published_at
--   public.answers has no published_at column — the workflow columns are
--   status, last_verified_at, valid_from/valid_until and updated_at. An
--   earlier draft of this migration assumed one and failed with
--   "column a.published_at does not exist". Publication time is recorded in
--   answer_audit_logs instead, which is also what makes the rollback exact.
--
-- SAFE TO RE-RUN
--   Only touches rows that are still 'draft'. Anything already published,
--   edited or reviewed is left exactly as it is. Running it twice publishes
--   nothing the second time and writes no audit rows.
--
-- ROLLBACK
--   See section 4 at the bottom. It reverses only the rows this migration
--   published, by reading the audit trail written in section 1.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Publish every Skardu draft that carries no verification marker
-- ----------------------------------------------------------------------------
do $$
declare
  v_skardu uuid;
  v_count  integer;
begin
  select id into v_skardu
  from public.locations
  where slug = 'skardu'
  limit 1;

  if v_skardu is null then
    raise notice 'phase88: no Skardu location row found — nothing to do.';
    return;
  end if;

  create temporary table _phase88_published (id uuid primary key) on commit drop;

  with ready as (
    select id
    from public.answers
    where location_id = v_skardu
      and status = 'draft'
      -- The marker can sit in either field. Both are checked.
      and coalesce(short_answer, '')    not like '%[VERIFY:%'
      and coalesce(detailed_answer, '') not like '%[VERIFY:%'
  ),
  done as (
    update public.answers a
       set status     = 'published',
           updated_at = now()
      from ready
     where a.id = ready.id
    returning a.id
  )
  insert into _phase88_published (id)
  select id from done;

  get diagnostics v_count = row_count;

  -- Audit trail. This is the record of what this migration changed, and the
  -- rollback in section 4 reads it back — so a hand-published answer is never
  -- caught up in an undo.
  insert into public.answer_audit_logs (answer_id, actor_email, action, after_value)
  select id, 'phase88-migration', 'published',
         jsonb_build_object('status', 'published', 'via', 'phase88')
  from _phase88_published;

  raise notice 'phase88: published % Skardu answer(s).', v_count;
end $$;


-- ----------------------------------------------------------------------------
-- 2. What is now live
-- ----------------------------------------------------------------------------
select
  a.display_order,
  a.status,
  a.question
from public.answers a
join public.locations l on l.id = a.location_id
where l.slug = 'skardu'
order by a.display_order;


-- ----------------------------------------------------------------------------
-- 3. What is still held back, and exactly what each one needs
-- ----------------------------------------------------------------------------
--
-- Each row tells you the fact to go and find. Once you have it with a source,
-- edit the answer in the admin Answers manager, delete the [VERIFY: ...] line,
-- and publish it there — the trigger will then allow it.
--
-- Answers that quote a price, a fare or a date should also be marked
-- time-sensitive with valid_until set, so they cannot quietly go stale.
--
select
  a.display_order,
  a.question,
  (
    regexp_match(
      coalesce(a.detailed_answer, '') || coalesce(a.short_answer, ''),
      '\[VERIFY:([^\]]*)\]'
    )
  )[1] as still_needed
from public.answers a
join public.locations l on l.id = a.location_id
where l.slug = 'skardu'
  and a.status = 'draft'
order by a.display_order;

commit;


-- ============================================================================
-- 4. ROLLBACK
-- ============================================================================
-- Returns to draft ONLY the answers this migration published, identified from
-- the audit rows it wrote. Answers published by hand in the admin are not
-- touched, because they have no phase88 audit row.
--
-- Check first, then run the update.
--
-- begin;
--
--   select a.display_order, a.status, a.question
--     from public.answers a
--    where a.id in (
--            select answer_id from public.answer_audit_logs
--             where actor_email = 'phase88-migration' and action = 'published'
--          );
--
--   update public.answers a
--      set status = 'draft', updated_at = now()
--    where a.status = 'published'
--      and a.id in (
--            select answer_id from public.answer_audit_logs
--             where actor_email = 'phase88-migration' and action = 'published'
--          );
--
--   insert into public.answer_audit_logs (answer_id, actor_email, action, after_value)
--   select answer_id, 'phase88-rollback', 'unpublished',
--          jsonb_build_object('status', 'draft', 'via', 'phase88-rollback')
--     from public.answer_audit_logs
--    where actor_email = 'phase88-migration' and action = 'published';
--
-- commit;
-- ============================================================================
