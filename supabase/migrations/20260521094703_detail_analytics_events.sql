-- Wave 503 (2026-05-21): detail analytics events.
-- Purpose: understand where users move inside detail/easy-mode before payment.
-- Access model: server API writes with service_role only. Browser never writes
-- directly to this table.

create table if not exists public.mvp_detail_events (
  id bigserial primary key,
  user_ref text not null,
  auth_user_id uuid,
  pid bigint not null references public.mvp_raw_listings(pid) on delete cascade,
  event_type text not null,
  surface text not null default 'detail_modal',
  session_id text,
  step_index integer,
  step_total integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mvp_detail_events_created_at_idx
  on public.mvp_detail_events(created_at desc);

create index if not exists mvp_detail_events_user_created_idx
  on public.mvp_detail_events(user_ref, created_at desc);

create index if not exists mvp_detail_events_pid_created_idx
  on public.mvp_detail_events(pid, created_at desc);

create index if not exists mvp_detail_events_type_created_idx
  on public.mvp_detail_events(event_type, created_at desc);

create index if not exists mvp_detail_events_session_idx
  on public.mvp_detail_events(session_id, created_at desc)
  where session_id is not null;

alter table public.mvp_detail_events enable row level security;

drop policy if exists mvp_detail_events_anon_block on public.mvp_detail_events;
create policy mvp_detail_events_anon_block
  on public.mvp_detail_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
