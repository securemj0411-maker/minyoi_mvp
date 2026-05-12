-- P0-3: rate limiter for user-facing paid endpoints (packs/open 등).
-- 단일 row per bucket. window roll 시 overwrite → cleanup 불필요.

create table if not exists public.mvp_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null,
  updated_at timestamptz not null default now()
);

alter table public.mvp_rate_limits enable row level security;

create or replace function public.check_mvp_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  current_count integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
  v_key text;
  v_max integer;
  v_window integer;
begin
  v_key := nullif(left(trim(coalesce(p_bucket_key, '')), 200), '');
  v_max := greatest(1, coalesce(p_max_requests, 1));
  v_window := greatest(1, coalesce(p_window_seconds, 1));

  if v_key is null then
    return query select true, 0, v_now;
    return;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now)::numeric / v_window) * v_window
  );

  insert into public.mvp_rate_limits (bucket_key, window_started_at, request_count, updated_at)
  values (v_key, v_window_start, 1, v_now)
  on conflict (bucket_key) do update set
    window_started_at = case
      when public.mvp_rate_limits.window_started_at = excluded.window_started_at
        then public.mvp_rate_limits.window_started_at
      else excluded.window_started_at
    end,
    request_count = case
      when public.mvp_rate_limits.window_started_at = excluded.window_started_at
        then public.mvp_rate_limits.request_count + 1
      else 1
    end,
    updated_at = v_now
  returning public.mvp_rate_limits.request_count into v_count;

  return query select
    v_count <= v_max,
    v_count,
    v_window_start + make_interval(secs => v_window);
end;
$$;

revoke all on function public.check_mvp_rate_limit(text, integer, integer) from public;
revoke execute on function public.check_mvp_rate_limit(text, integer, integer) from anon;
revoke execute on function public.check_mvp_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.check_mvp_rate_limit(text, integer, integer) to service_role;
