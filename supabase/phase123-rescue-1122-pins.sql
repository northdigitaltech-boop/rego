-- ============================================================
-- phase123 — Rescue 1122 stations in Gilgit-Baltistan.
--
-- REQUIRES phase124 (coordinates optional). Run that first —
-- without it the five rows below are rejected by NOT NULL.
--
-- Seven stations were supplied. TWO have a confirmed location.
-- The other five do not, and this file does not pretend
-- otherwise: their latitude and longitude are NULL, not a guess.
--
-- ---------------------------------------------------------------------------
-- WHY THE OTHER FIVE ARE STILL WORTH INSERTING
--
-- A station whose phone number, district and town are known is a
-- useful record even before anyone has confirmed the exact spot.
-- What it must not be is a pin: an emergency service drawn in
-- roughly the right district sends somebody to the wrong place
-- at the worst possible moment.
--
-- So those five carry:
--   * latitude and longitude NULL — the map cannot draw them,
--     enforced by isLocated() rather than by anyone remembering
--   * published = false, so they are not public at all yet
--   * is_verified = false
--   * PIN NOT VERIFIED in source, which the admin list reads to
--     show an amber badge on the row and in the edit form
--
-- WHAT IS NOT CLAIMED HERE
--   Nothing in this file asserts a station is open, staffed, or
--   reachable beyond what was supplied. Roundu and Daghoni were
--   given as government projects rather than operating stations,
--   so both are recorded with status 'closed' and said plainly in
--   the description. Neither is published.
--
-- SAFETY
--   Insert-only, guarded by name + category, so re-running it
--   changes nothing. No existing row is read, updated or deleted.
-- ============================================================

insert into public.map_places
  (name, category, region, district, city, latitude, longitude,
   description, contact_number, status, is_verified, source, published)
select v.name, 'rescue', 'Gilgit-Baltistan', v.district, v.city, v.lat, v.lng,
       v.description, v.contact, v.status, v.verified, v.source, v.published
from (values
  -- ---------- Confirmed location: published ----------
  (
    'Rescue 1122 City Office Skardu', 'Skardu', 'Hameed Garh',
    35.294663::double precision, 75.650828::double precision,
    'District emergency service office.',
    '1122, 05815-921133', 'open', true,
    'Coordinates decoded from listed Plus Code 7MV2+V88', true
  ),
  (
    'Rescue 1122 Shigar', 'Shigar', 'Sainkhor, Shigar',
    35.439263::double precision, 75.732453::double precision,
    'District emergency service station.',
    '1122', 'open', true,
    'Coordinates decoded from listed Plus Code CPQJ+PX4', true
  ),

  -- ---------- Location not confirmed: hidden until fixed ----------
  (
    'Rescue 1122 Skardu', 'Skardu', 'Maqpoonsar, near Radio Pakistan Chowk',
    null::double precision, null::double precision,
    'Location not confirmed — add the exact coordinates before publishing.',
    '1122, 05815-921077, 05815-921078', 'open', false,
    'PIN NOT VERIFIED — station and phone numbers supplied; exact coordinates still to be confirmed', false
  ),
  (
    'Rescue 1122 Khaplu', 'Ghanche', 'Khaplu',
    null::double precision, null::double precision,
    'Location not confirmed — add the exact coordinates before publishing.',
    '1122, 05816-921122', 'open', false,
    'PIN NOT VERIFIED — district service and phone numbers supplied; exact coordinates still to be confirmed', false
  ),
  (
    'Rescue 1122 Kharmang', 'Kharmang', null,
    null::double precision, null::double precision,
    'The district service is documented; the station location is not. '
      || 'Add the exact coordinates before publishing.',
    '1122', 'open', false,
    'PIN NOT VERIFIED — no public map listing found for the station', false
  ),
  (
    'Emergency Service Roundu', 'Roundu', 'Jaglot–Skardu Road corridor',
    null::double precision, null::double precision,
    'NOT AN OPERATING STATION — recorded as a government establishment project. '
      || 'Do not publish or mark open until the station is confirmed operational.',
    '1122', 'closed', false,
    'PIN NOT VERIFIED — establishment project; no operational station or public map pin confirmed', false
  ),
  (
    'Rescue 1122 Daghoni', 'Ghanche', 'Daghoni',
    null::double precision, null::double precision,
    'PLANNED — recorded as a government ADP project, not an active station. '
      || 'Do not publish as an active station.',
    '1122', 'closed', false,
    'PIN NOT VERIFIED — ADP project in development; no operational station confirmed', false
  )
) as v(name, district, city, lat, lng, description, contact, status, verified, source, published)
where not exists (
  select 1 from public.map_places m
  where m.category = 'rescue' and lower(m.name) = lower(v.name)
);

-- ============================================================
-- WHAT TO DO NEXT (in the admin: Rego Map → Pins)
--
--   The five hidden rows each show an amber "Pin not verified"
--   badge and read "No coordinates — not shown on the map".
--   For each one: press Edit, fill in the real station latitude
--   and longitude, delete the words PIN NOT VERIFIED from
--   Source, tick Verified, save, then press Publish.
--
--   Roundu and Daghoni should stay unpublished until the
--   stations are actually operating, whatever their coordinates
--   turn out to be.
-- ============================================================

-- ============================================================
-- ROLLBACK
--
-- Removes only the seven rows this file added, by exact name,
-- and only while they are still untouched — the `is_verified is
-- false or source like ...` guard means a pin somebody has since
-- corrected and verified is NOT deleted by an undo.
--
--   delete from public.map_places
--   where category = 'rescue'
--     and name in (
--       'Rescue 1122 City Office Skardu', 'Rescue 1122 Shigar',
--       'Rescue 1122 Skardu', 'Rescue 1122 Khaplu',
--       'Rescue 1122 Kharmang', 'Emergency Service Roundu',
--       'Rescue 1122 Daghoni'
--     )
--     and (source like '%PIN NOT VERIFIED%'
--          or source like '%Plus Code%');
-- ============================================================
