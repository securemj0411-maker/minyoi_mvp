create table if not exists public.mvp_candidate_pool (
  pid bigint primary key references public.mvp_raw_listings(pid) on delete cascade,
  profit_band smallint not null check (profit_band in (1, 2, 3)),
  expected_profit_min integer not null,
  expected_profit_max integer not null,
  score numeric not null default 0,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  comparable_key text,
  status text not null default 'ready' check (status in ('ready', 'reserved', 'spent', 'invalidated')),
  exposure_count integer not null default 0 check (exposure_count >= 0),
  max_exposure integer not null default 2 check (max_exposure >= 1),
  reserved_until timestamptz,
  last_verified_at timestamptz not null default now(),
  invalidated_reason text,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mvp_pack_opens (
  id bigserial primary key,
  user_ref text not null,
  band_requested smallint not null check (band_requested in (1, 2, 3)),
  tokens_spent integer not null check (tokens_spent >= 0),
  tokens_refunded integer not null default 0 check (tokens_refunded >= 0),
  result text not null check (result in ('success', 'refunded', 'failed')),
  attempted_pids bigint[] not null default '{}'::bigint[],
  revealed_pids bigint[] not null default '{}'::bigint[],
  duration_ms integer,
  opened_at timestamptz not null default now()
);

create table if not exists public.mvp_pack_reveals (
  id bigserial primary key,
  pack_open_id bigint not null references public.mvp_pack_opens(id) on delete cascade,
  pid bigint not null references public.mvp_raw_listings(pid) on delete cascade,
  user_ref text not null,
  expected_profit_min integer not null,
  expected_profit_max integer not null,
  confidence numeric not null,
  link_clicked_at timestamptz,
  revealed_at timestamptz not null default now(),
  unique (user_ref, pid)
);

create index if not exists mvp_candidate_pool_band_status_idx
  on public.mvp_candidate_pool(profit_band, status, last_verified_at desc);

create index if not exists mvp_candidate_pool_reserved_idx
  on public.mvp_candidate_pool(reserved_until)
  where status = 'reserved';

create index if not exists mvp_pack_opens_user_idx
  on public.mvp_pack_opens(user_ref, opened_at desc);

create index if not exists mvp_pack_reveals_user_idx
  on public.mvp_pack_reveals(user_ref, revealed_at desc);

create index if not exists mvp_pack_reveals_pack_idx
  on public.mvp_pack_reveals(pack_open_id);

alter table public.mvp_candidate_pool enable row level security;
alter table public.mvp_pack_opens enable row level security;
alter table public.mvp_pack_reveals enable row level security;

create or replace function public.reserve_mvp_pool_candidates(
  p_band smallint,
  p_user_ref text,
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns table (
  pid bigint,
  profit_band smallint,
  expected_profit_min integer,
  expected_profit_max integer,
  score numeric,
  confidence numeric,
  comparable_key text,
  exposure_count integer,
  max_exposure integer,
  last_verified_at timestamptz,
  reserved_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with quality_candidates as (
    select pp.pid
    from public.mvp_candidate_pool pp
    where pp.profit_band = p_band
      and (pp.status = 'ready' or (pp.status = 'reserved' and pp.reserved_until < now()))
      and pp.exposure_count < pp.max_exposure
      and not exists (
        select 1 from public.mvp_pack_reveals r
        where r.user_ref = p_user_ref and r.pid = pp.pid
      )
    order by pp.exposure_count asc,
             pp.confidence desc,
             pp.score desc,
             pp.last_verified_at desc
    limit greatest(1, least(coalesce(p_limit, 5), 50)) * 8
    for update skip locked
  ), candidates as (
    select pid
    from quality_candidates
    order by random()
    limit greatest(1, least(coalesce(p_limit, 5), 50))
  ), claimed as (
    update public.mvp_candidate_pool p
    set status = 'reserved',
        reserved_until = now() + (greatest(30, least(coalesce(p_lease_seconds, 300), 1800)) || ' seconds')::interval,
        updated_at = now()
    from candidates c
    where p.pid = c.pid
    returning p.pid,
              p.profit_band,
              p.expected_profit_min,
              p.expected_profit_max,
              p.score,
              p.confidence,
              p.comparable_key,
              p.exposure_count,
              p.max_exposure,
              p.last_verified_at,
              p.reserved_until
  )
  select * from claimed;
end;
$$;

revoke all on function public.reserve_mvp_pool_candidates(smallint, text, integer, integer) from public;
revoke execute on function public.reserve_mvp_pool_candidates(smallint, text, integer, integer) from anon;
revoke execute on function public.reserve_mvp_pool_candidates(smallint, text, integer, integer) from authenticated;
grant execute on function public.reserve_mvp_pool_candidates(smallint, text, integer, integer) to service_role;

create or replace function public.commit_mvp_pool_reveal(
  p_pid bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mvp_candidate_pool
  set exposure_count = exposure_count + 1,
      status = case
        when exposure_count + 1 >= max_exposure then 'spent'
        else 'ready'
      end,
      reserved_until = null,
      updated_at = now()
  where pid = p_pid;
end;
$$;

revoke all on function public.commit_mvp_pool_reveal(bigint) from public;
revoke execute on function public.commit_mvp_pool_reveal(bigint) from anon;
revoke execute on function public.commit_mvp_pool_reveal(bigint) from authenticated;
grant execute on function public.commit_mvp_pool_reveal(bigint) to service_role;

create or replace function public.release_mvp_pool_reservation(
  p_pid bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mvp_candidate_pool
  set status = case
        when exposure_count >= max_exposure then 'spent'
        else 'ready'
      end,
      reserved_until = null,
      updated_at = now()
  where pid = p_pid and status = 'reserved';
end;
$$;

revoke all on function public.release_mvp_pool_reservation(bigint) from public;
revoke execute on function public.release_mvp_pool_reservation(bigint) from anon;
revoke execute on function public.release_mvp_pool_reservation(bigint) from authenticated;
grant execute on function public.release_mvp_pool_reservation(bigint) to service_role;

create or replace function public.invalidate_mvp_pool_entry(
  p_pid bigint,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mvp_candidate_pool
  set status = 'invalidated',
      invalidated_reason = p_reason,
      reserved_until = null,
      updated_at = now()
  where pid = p_pid;
end;
$$;

revoke all on function public.invalidate_mvp_pool_entry(bigint, text) from public;
revoke execute on function public.invalidate_mvp_pool_entry(bigint, text) from anon;
revoke execute on function public.invalidate_mvp_pool_entry(bigint, text) from authenticated;
grant execute on function public.invalidate_mvp_pool_entry(bigint, text) to service_role;

notify pgrst, 'reload schema';
