/* ============================================================
 * phase139 — room detail fields
 *
 * ADDITIVE AND IDEMPOTENT. Only adds nullable text columns.
 * No existing column, row or policy is changed. ROLLBACK below.
 *
 * Each room type can now describe itself on the public page:
 *
 *     Room size · Max guests · Bed setup · Classification ·
 *     Scenic view · Wi-Fi & climate
 *
 * Max guests and bed setup already existed (guests/max_guests, beds).
 * homestay_rooms and hostel_rooms already had room_size. This adds the
 * rest. Every field is optional and typed by the owner — nothing is
 * filled in for them, and an empty field is simply not shown.
 *
 * The app keeps working before this runs: saving a room retries
 * without these fields if the database does not have them yet.
 * ============================================================ */

alter table public.rooms          add column if not exists room_size      text;
alter table public.rooms          add column if not exists view_type      text;
alter table public.rooms          add column if not exists classification text;
alter table public.rooms          add column if not exists wifi_climate   text;

alter table public.homestay_rooms add column if not exists view_type      text;
alter table public.homestay_rooms add column if not exists classification text;
alter table public.homestay_rooms add column if not exists wifi_climate   text;

alter table public.hostel_rooms   add column if not exists view_type      text;
alter table public.hostel_rooms   add column if not exists classification text;
alter table public.hostel_rooms   add column if not exists wifi_climate   text;

/* Ask PostgREST to pick up the new columns now rather than on its next
   schema refresh, so saving a room with them works immediately. */
notify pgrst, 'reload schema';

select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('rooms', 'homestay_rooms', 'hostel_rooms')
   and column_name in ('room_size', 'view_type', 'classification', 'wifi_climate')
 order by table_name, column_name;

/* ------------------------------------------------------------------
 * ROLLBACK (drops only what this file added; homestay/hostel room_size
 * existed before and is kept):
 *
 * alter table public.rooms          drop column if exists room_size,
 *                                   drop column if exists view_type,
 *                                   drop column if exists classification,
 *                                   drop column if exists wifi_climate;
 * alter table public.homestay_rooms drop column if exists view_type,
 *                                   drop column if exists classification,
 *                                   drop column if exists wifi_climate;
 * alter table public.hostel_rooms   drop column if exists view_type,
 *                                   drop column if exists classification,
 *                                   drop column if exists wifi_climate;
 * ------------------------------------------------------------------ */
