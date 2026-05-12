-- P0-3: cron guard DB lease.
-- 기존 globalThis 메모리 guard는 단일 인스턴스에서만 유효. Vercel 멀티 인스턴스에서는 락 효과 없음.
-- mvp_cron_locks 테이블 + try_acquire/release RPC로 DB 단위 lease를 추가한다.
-- 기존 메모리 guard는 그대로 유지(빠른 fail) + DB lease는 보강 계층.

create table if not exists public.mvp_cron_locks (
  mode text primary key,
  owner text not null,
  acquired_at timestamptz not null default now(),
  lease_until timestamptz not null
);

create index if not exists mvp_cron_locks_lease_until_idx
  on public.mvp_cron_locks(lease_until);

create or replace function public.try_acquire_mvp_cron_lock(
  p_mode text,
  p_owner text,
  p_lease_seconds int
) returns table(acquired boolean, owner text, lease_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_lease_until timestamptz := v_now + make_interval(secs => p_lease_seconds);
  v_row public.mvp_cron_locks;
begin
  -- 만료된 락을 가진 row가 있으면 우리가 가져간다. 살아있는 락이 있으면 INSERT 충돌만 일어남.
  insert into public.mvp_cron_locks as locks (mode, owner, acquired_at, lease_until)
  values (p_mode, p_owner, v_now, v_lease_until)
  on conflict (mode) do update
    set owner = excluded.owner,
        acquired_at = excluded.acquired_at,
        lease_until = excluded.lease_until
    where locks.lease_until <= v_now;

  select * into v_row from public.mvp_cron_locks where mode = p_mode;

  return query
    select (v_row.owner = p_owner and v_row.acquired_at = v_now) as acquired,
           v_row.owner,
           v_row.lease_until;
end;
$$;

create or replace function public.release_mvp_cron_lock(
  p_mode text,
  p_owner text
) returns boolean
language sql
security definer
set search_path = public
as $$
  delete from public.mvp_cron_locks
  where mode = p_mode and owner = p_owner
  returning true;
$$;
