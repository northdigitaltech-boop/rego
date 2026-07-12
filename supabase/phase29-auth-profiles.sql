-- ============================================================
-- SAFARIGB — Phase 29: Supabase Auth foundation (profiles + admin role)
-- Safe to run now: only ADDS a profiles table + a signup trigger. It does NOT
-- change any existing table or policy, so the live app keeps working until we
-- flip the per-table RLS policies in a later phase.
--
-- Ownership model: RLS will compare auth.email() to each table's existing
-- owner_email column (no schema changes needed on listing tables).
-- Admin: a row in profiles with role='admin'.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  role text not null default 'customer',          -- customer | partner | admin
  business_category text,
  avatar text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- A user can see/update only their own profile.
do $$
begin
  begin create policy "profiles_self_read"   on public.profiles for select using (auth.uid() = id); exception when duplicate_object then null; end;
  begin create policy "profiles_self_insert" on public.profiles for insert with check (auth.uid() = id); exception when duplicate_object then null; end;
  begin create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id); exception when duplicate_object then null; end;
end $$;

-- Helper used by every future admin policy: is the caller an admin?
create or replace function public.is_admin()
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Admins can read all profiles.
do $$
begin
  begin create policy "profiles_admin_read" on public.profiles for select using (public.is_admin()); exception when duplicate_object then null; end;
end $$;

-- Auto-create a profile row whenever a new auth user signs up. Reads the
-- metadata the app passes to supabase.auth.signUp({ data: {...} }).
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, business_category, avatar)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'business_category',
    new.raw_user_meta_data->>'avatar'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- After you sign up your own admin account through the app, promote it:
--   update public.profiles set role = 'admin' where email = 'youradmin@example.com';
