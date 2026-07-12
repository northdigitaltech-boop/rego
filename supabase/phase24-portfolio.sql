-- ============================================================
-- SAFARIGB — Phase 24: Rich media portfolio / showcase
-- Extends media_portfolio with project metadata + video embeds so drone &
-- media providers can showcase their work to customers before booking.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.media_portfolio add column if not exists title             text;
alter table public.media_portfolio add column if not exists category          text;
alter table public.media_portfolio add column if not exists location          text;
alter table public.media_portfolio add column if not exists project_date      text;
alter table public.media_portfolio add column if not exists drone_model       text;
alter table public.media_portfolio add column if not exists camera_quality    text;
alter table public.media_portfolio add column if not exists services_included text[];
alter table public.media_portfolio add column if not exists description       text;
alter table public.media_portfolio add column if not exists video_url         text;
alter table public.media_portfolio add column if not exists gallery           text[];
