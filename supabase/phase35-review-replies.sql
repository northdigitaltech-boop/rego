-- ============================================================
-- SAFARIGB — Phase 35: Owner replies to reviews
-- Lets a listing owner post a public reply under a customer review, for every
-- module. Two review stores:
--   * public.reviews          (hotels, homestays, tours, transport, guides,
--                              media, restaurants) — keyed by hotel_id/owner_email
--   * public.roadside_reviews (roadside providers) — keyed by provider_id
--
-- Ownership for the reply write:
--   * reviews: owner_email on the row must equal auth.email() (stored at review
--     time going forward). Older reviews without owner_email can be replied to
--     by an admin, or backfilled.
--   * roadside_reviews: the reply author must own the linked provider.
-- Requires phase29 (is_admin).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------- Shared reviews ---------- */
alter table public.reviews
  add column if not exists owner_reply     text,
  add column if not exists owner_reply_at  timestamptz,
  add column if not exists owner_email     text;

-- Owner (or admin) may update the row (used for posting/editing the reply).
drop policy if exists "update reviews" on public.reviews;
create policy "update reviews" on public.reviews for update
  using (owner_email = auth.email() or public.is_admin())
  with check (owner_email = auth.email() or public.is_admin());

/* ---------- Roadside reviews ---------- */
alter table public.roadside_reviews
  add column if not exists owner_reply    text,
  add column if not exists owner_reply_at timestamptz;

-- Replace phase32's admin-only update policy with one that also lets the
-- provider that owns the reviewed listing post a reply.
do $$
begin
  drop policy if exists "rrev_update" on public.roadside_reviews;
  create policy "rrev_update" on public.roadside_reviews for update
    using (
      public.is_admin() or exists (
        select 1 from public.roadside_providers p
        where p.id = roadside_reviews.provider_id
          and p.owner_email = auth.email()
      )
    )
    with check (
      public.is_admin() or exists (
        select 1 from public.roadside_providers p
        where p.id = roadside_reviews.provider_id
          and p.owner_email = auth.email()
      )
    );
end $$;
