alter table public.mvp_raw_listings
  add column if not exists pool_eligible boolean not null default true;

comment on column public.mvp_raw_listings.pool_eligible is
  'Whether a raw listing may enter public candidate-pool scoring. Internal acquisition/observation rows should set this false.';
