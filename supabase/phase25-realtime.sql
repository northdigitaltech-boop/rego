-- ============================================================
-- SAFARIGB — Phase 25: Enable Realtime for chat / notifications
-- Lets the app receive new messages over a websocket instead of polling the
-- database every few seconds. Cuts database requests dramatically and makes
-- chat + booking alerts feel instant.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Add the messages table to the realtime publication (id_empotent-ish: wrap in
-- a DO block so re-running doesn't error if it's already a member).
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception
    when duplicate_object then null;  -- already added
    when undefined_object then
      -- publication doesn't exist (very old project) — create it
      create publication supabase_realtime for table public.messages;
  end;
end $$;

-- Ensure full row data is sent on changes (so payload.new has every column).
alter table public.messages replica identity full;
