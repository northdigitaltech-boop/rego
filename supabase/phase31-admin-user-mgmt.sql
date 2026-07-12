-- ============================================================
-- SAFARIGB — Phase 31: Admin client-account management
-- Adds phone to profiles and an admin audit log for password/email/phone
-- changes. The actual credential updates happen in a server API route using
-- the service-role key (never in the browser).
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.profiles add column if not exists phone text;

create table if not exists public.admin_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid,
  admin_email    text,
  target_user_id uuid,
  target_email   text,
  field          text,        -- password | email | phone
  note           text,        -- required "reason for update"
  created_at     timestamptz default now()
);

alter table public.admin_audit_logs enable row level security;

-- Only admins may read the audit log. (Writes come from the server route via
-- the service-role key, which bypasses RLS.)
do $$
begin
  begin
    create policy "audit_admin_read" on public.admin_audit_logs
      for select using (public.is_admin());
  exception when duplicate_object then null; end;
end $$;
