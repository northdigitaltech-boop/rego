-- ============================================================
-- Phase 67 — Vehicle specification fields
--
-- The details travellers actually compare on before booking a vehicle:
-- transmission, air conditioning, fuel type and luggage capacity.
--
-- All nullable. Nothing is required of existing partners, and a card only
-- shows a badge for a field that has been filled in.
-- ============================================================

/* ---- Transport services (with driver) ---- */
alter table if exists public.transport_services
  add column if not exists transmission text,      -- Automatic | Manual
  add column if not exists luggage_capacity text;  -- e.g. "3 large bags"

/* ---- Rental vehicles (self-drive) ---- */
alter table if exists public.rental_vehicles
  add column if not exists transmission text,
  add column if not exists ac boolean not null default false,
  add column if not exists fuel_type text,          -- Petrol | Diesel | Hybrid | Electric
  add column if not exists luggage_capacity text;

/* ---- Tour-company vehicles ---- */
alter table if exists public.transports
  add column if not exists transmission text,
  add column if not exists luggage_capacity text;

comment on column public.rental_vehicles.transmission is
  'Automatic | Manual. Shown as a badge on the vehicle card.';
comment on column public.rental_vehicles.ac is
  'Air conditioning. A major comfort factor on GB summer routes.';
