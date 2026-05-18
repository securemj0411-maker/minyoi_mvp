-- Wave 238 (2026-05-18): keep reveal feedback types from overwriting each other.
--
-- Old shape:
--   unique (user_ref, pid)
--
-- That made `bought`, `watching`, `bad_pick`, `loss_report`, and
-- `inaccurate_report` compete for the same row. A report could erase a bought
-- signal, or a future transaction-state CTA could erase an admin review queue
-- item. Scope uniqueness by feedback_type so each user/listing can keep one
-- row per intent.

alter table public.mvp_reveal_feedback
  drop constraint if exists mvp_reveal_feedback_feedback_type_check;

alter table public.mvp_reveal_feedback
  add constraint mvp_reveal_feedback_feedback_type_check
  check (feedback_type in (
    'interested',
    'bought',
    'missed_sold',
    'bad_pick',
    'watching',
    'loss_report',
    'inaccurate_report'
  ));

alter table public.mvp_reveal_feedback
  add column if not exists admin_status text,
  add column if not exists admin_response_note text,
  add column if not exists admin_responded_at timestamptz,
  add column if not exists compensation_granted_tokens integer not null default 0,
  add column if not exists user_seen_at timestamptz;

alter table public.mvp_reveal_feedback
  alter column compensation_granted_tokens set default 0;

update public.mvp_reveal_feedback
set compensation_granted_tokens = 0
where compensation_granted_tokens is null;

alter table public.mvp_reveal_feedback
  alter column compensation_granted_tokens set not null;

alter table public.mvp_reveal_feedback
  drop constraint if exists mvp_reveal_feedback_admin_status_chk;

alter table public.mvp_reveal_feedback
  add constraint mvp_reveal_feedback_admin_status_chk
  check (admin_status is null or admin_status in ('pending', 'resolved', 'dismissed'));

alter table public.mvp_reveal_feedback
  drop constraint if exists mvp_reveal_feedback_user_ref_pid_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mvp_reveal_feedback'::regclass
      and conname = 'mvp_reveal_feedback_user_ref_pid_feedback_type_key'
  ) then
    alter table public.mvp_reveal_feedback
      add constraint mvp_reveal_feedback_user_ref_pid_feedback_type_key
      unique (user_ref, pid, feedback_type);
  end if;
end $$;

create index if not exists mvp_reveal_feedback_user_pid_type_idx
  on public.mvp_reveal_feedback(user_ref, pid, feedback_type);

create index if not exists mvp_reveal_feedback_admin_status_idx
  on public.mvp_reveal_feedback(admin_status, created_at desc)
  where feedback_type in ('loss_report', 'inaccurate_report');

create index if not exists mvp_reveal_feedback_user_unread_idx
  on public.mvp_reveal_feedback(user_ref, admin_responded_at desc)
  where feedback_type = 'inaccurate_report' and admin_responded_at is not null;
