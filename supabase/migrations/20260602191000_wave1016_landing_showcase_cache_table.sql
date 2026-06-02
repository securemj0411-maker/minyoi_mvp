-- Wave 1016: landing showcase cache table.
-- Production was missing this table, so landing fallback kept hitting the
-- expensive sold raw-listing scan and timing out.

create table if not exists public.mvp_landing_showcases (
  id bigserial primary key,
  slot_index smallint not null check (slot_index between 1 and 10),
  pid bigint not null references public.mvp_raw_listings(pid) on delete cascade,
  name text not null,
  image_url text not null,
  buy_price integer not null check (buy_price >= 0),
  market_price integer not null check (market_price >= 0),
  expected_profit integer not null,
  confidence_percent integer not null check (confidence_percent between 0 and 100),
  sku_label text,
  sample_count integer not null default 0 check (sample_count >= 0),
  is_active boolean not null default true,
  source_snapshot jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (slot_index),
  unique (pid)
);

create index if not exists mvp_landing_showcases_active_slot_idx
  on public.mvp_landing_showcases (is_active, slot_index, updated_at desc);

alter table public.mvp_landing_showcases enable row level security;

revoke all on public.mvp_landing_showcases from anon;
revoke all on public.mvp_landing_showcases from authenticated;
grant select, insert, update, delete on public.mvp_landing_showcases to service_role;
grant usage, select on sequence public.mvp_landing_showcases_id_seq to service_role;

notify pgrst, 'reload schema';
