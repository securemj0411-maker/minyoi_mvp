-- Wave 240 (2026-05-18): user dashboard soft-hide.
--
-- `/me` "삭제" is a user-facing hide action. Hard-deleting reveal rows also
-- deleted/stranded feedback signals and broke the retention learning loop.
-- Keep the reveal and feedback history, hide from the dashboard by timestamp.

alter table public.mvp_pack_reveals
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_reason text,
  add column if not exists hidden_source text;

create index if not exists mvp_pack_reveals_visible_user_idx
  on public.mvp_pack_reveals(user_ref, revealed_at desc)
  where hidden_at is null;

create index if not exists mvp_pack_reveals_hidden_user_idx
  on public.mvp_pack_reveals(user_ref, hidden_at desc)
  where hidden_at is not null;
