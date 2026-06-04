-- Wave 1113: membership application local sample cache.
-- Plans flow should read a precomputed real Daangn sample instead of joining
-- candidate_pool/raw_listings/velocity at request time for every applicant.

create table if not exists public.mvp_membership_local_samples (
  id bigserial primary key,
  district_name text not null,
  region_key text,
  slot_index smallint not null default 1 check (slot_index between 1 and 5),
  payload jsonb not null,
  is_active boolean not null default true,
  source_snapshot jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (district_name, slot_index)
);

create index if not exists mvp_membership_local_samples_active_district_idx
  on public.mvp_membership_local_samples (is_active, district_name, slot_index, updated_at desc);

create index if not exists mvp_membership_local_samples_active_updated_idx
  on public.mvp_membership_local_samples (is_active, updated_at desc);

alter table public.mvp_membership_local_samples enable row level security;

revoke all on public.mvp_membership_local_samples from anon;
revoke all on public.mvp_membership_local_samples from authenticated;
grant select, insert, update, delete on public.mvp_membership_local_samples to service_role;
grant usage, select on sequence public.mvp_membership_local_samples_id_seq to service_role;

notify pgrst, 'reload schema';
