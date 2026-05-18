-- Welcome pack idempotency guard.
-- A new user should receive exactly one welcome pack (4 cards). The previous
-- route-level "select existing reveals, then open" check was race-prone under
-- concurrent POSTs.

create table if not exists public.mvp_welcome_grants (
  user_ref text primary key,
  auth_user_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  pack_open_id bigint references public.mvp_pack_opens(id) on delete set null,
  revealed_count integer not null default 0 check (revealed_count >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists mvp_welcome_grants_auth_user_idx
  on public.mvp_welcome_grants(auth_user_id);

alter table public.mvp_welcome_grants enable row level security;

drop policy if exists mvp_welcome_grants_anon_block on public.mvp_welcome_grants;
create policy mvp_welcome_grants_anon_block
  on public.mvp_welcome_grants
  for all
  to anon, authenticated
  using (false)
  with check (false);

