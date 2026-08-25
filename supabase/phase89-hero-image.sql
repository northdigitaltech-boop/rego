-- ============================================================================
-- phase89 — let an admin set the homepage hero image
-- ============================================================================
--
-- WHY
--   The hero is the first thing anyone sees and it was a file in the repo.
--   Changing it for a season, a festival or a campaign meant a developer and
--   a deploy. These columns move it into the admin.
--
-- WHERE
--   platform_settings, which is already the single-row table for
--   site-wide switches. It already has exactly the access this needs:
--   public SELECT (the homepage is read by signed-out visitors) and
--   admin-only writes. No new policies.
--
-- NOTHING BREAKS IF IT IS EMPTY
--   hero_image_url starts NULL and the site keeps serving the built-in
--   hero. The columns are additive; no existing column or policy is touched.
--
-- A NOTE ON THE IMAGE ITSELF
--   The hero is the Largest Contentful Paint element on the homepage — the
--   single measurement Google weighs most heavily. The built-in file is a
--   pre-sized WebP served from the CDN. An admin-set image is delivered
--   through Cloudinary with f_auto,q_auto and a width per breakpoint, which
--   gets close, but a very large upload will still be slower than the file
--   it replaces. The admin screen says so at the point of upload.
--
-- ROLLBACK
--   See section 3.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Columns
-- ----------------------------------------------------------------------------
alter table public.platform_settings
  -- Full image URL. Cloudinary in practice, but any absolute https URL works.
  add column if not exists hero_image_url  text,
  -- Alt text is deliberately separate and optional. The hero is decorative —
  -- the headline beside it carries the meaning — so an empty alt is correct
  -- here and inventing a description would be worse than none.
  add column if not exists hero_image_alt  text,
  add column if not exists hero_updated_at timestamptz;

-- Guard against a relative path or a javascript: URL being stored. The value
-- goes straight into an <img src> on the busiest page on the site.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'platform_settings_hero_url_https'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_hero_url_https
      check (hero_image_url is null or hero_image_url ~* '^https://');
  end if;
end $$;

-- Make sure the single settings row exists, so the admin screen has something
-- to update rather than needing to create it first.
insert into public.platform_settings (id)
values (1)
on conflict (id) do nothing;

commit;


-- ----------------------------------------------------------------------------
-- 2. Check
-- ----------------------------------------------------------------------------
select
  id,
  hero_image_url,
  hero_image_alt,
  hero_updated_at
from public.platform_settings
where id = 1;


-- ============================================================================
-- 3. ROLLBACK
-- ============================================================================
-- Drops the three columns and the constraint. The homepage returns to the
-- built-in hero on the next render — the code falls back whenever the value
-- is missing, including when the column itself is gone.
--
-- begin;
--   alter table public.platform_settings
--     drop constraint if exists platform_settings_hero_url_https;
--   alter table public.platform_settings
--     drop column if exists hero_image_url,
--     drop column if exists hero_image_alt,
--     drop column if exists hero_updated_at;
-- commit;
-- ============================================================================
