-- Wave 1039: materialized cache for the public guest preview pool.
-- Public /api/preview-pool must not recompute candidate, market, velocity,
-- and parsed rows per visitor. A cron endpoint refreshes this table instead.

create table if not exists public.mvp_preview_showcases (
  id bigserial primary key,
  slot_index smallint not null check (slot_index between 1 and 10),
  payload jsonb not null,
  is_active boolean not null default true,
  source_snapshot jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (slot_index)
);

create index if not exists mvp_preview_showcases_active_slot_idx
  on public.mvp_preview_showcases (is_active, slot_index, updated_at desc);

alter table public.mvp_preview_showcases enable row level security;

revoke all on public.mvp_preview_showcases from anon;
revoke all on public.mvp_preview_showcases from authenticated;
grant select, insert, update, delete on public.mvp_preview_showcases to service_role;
grant usage, select on sequence public.mvp_preview_showcases_id_seq to service_role;

notify pgrst, 'reload schema';
