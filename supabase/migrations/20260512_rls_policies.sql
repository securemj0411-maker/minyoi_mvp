-- P0-2: RLS policies for user-facing tables.
--
-- Background: all listed tables already have `enable row level security` but
-- no POLICY rows, which means anon/authenticated roles are denied by default
-- and service_role still bypasses RLS (server-side API path is unaffected).
-- This migration codifies that intent explicitly:
--   - public read on the listing catalog (so a future direct browser query
--     can fetch listing metadata without going through the server)
--   - service_role-only access on pack/feedback tables (no user_ref-based
--     "own only" because the app has no Supabase auth — user_ref is a client
--     -generated localStorage UUID and cannot be cryptographically bound to
--     the request)
--
-- Idempotent: drop-then-create on every named policy.

-- ---------------------------------------------------------------------------
-- mvp_listings: public catalog. Anon SELECT allowed; writes service_role only.
-- ---------------------------------------------------------------------------
drop policy if exists mvp_listings_anon_select on public.mvp_listings;
create policy mvp_listings_anon_select
  on public.mvp_listings
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- mvp_pack_opens: server-side only (service_role bypass). No anon policy.
-- Anon/authenticated default-deny on all operations.
-- ---------------------------------------------------------------------------
drop policy if exists mvp_pack_opens_anon_block on public.mvp_pack_opens;
create policy mvp_pack_opens_anon_block
  on public.mvp_pack_opens
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- mvp_pack_reveals: server-side only. Same pattern.
-- ---------------------------------------------------------------------------
drop policy if exists mvp_pack_reveals_anon_block on public.mvp_pack_reveals;
create policy mvp_pack_reveals_anon_block
  on public.mvp_pack_reveals
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- mvp_reveal_feedback: server-side only. Same pattern.
-- ---------------------------------------------------------------------------
drop policy if exists mvp_reveal_feedback_anon_block on public.mvp_reveal_feedback;
create policy mvp_reveal_feedback_anon_block
  on public.mvp_reveal_feedback
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Sanity: service_role bypasses RLS, so no grants needed. The DELETE+INSERT
-- statements issued by /api/debug/reset-db and pack-open lib continue to work
-- because both pass the service-role key in the Authorization header.
