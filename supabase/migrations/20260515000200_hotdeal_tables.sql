-- Wave 93b: 핫딜 큐 + 1:1 reservation. supabase MCP로 prod에 직접 박혔지만 migration 파일 누락 → audit에서 발견. idempotent (if not exists)로 안전 추가.

-- 1. 핫딜 후보 큐 (pool에서 차익 큰 매물 enqueue).
create table if not exists public.mvp_hotdeal_queue (
  pid bigint primary key,
  comparable_key text,
  profit_margin numeric,
  profit_amount bigint,
  sku_id text,
  sku_name text,
  band int,
  status text not null default 'available'
    check (status in ('available','reserved','consumed','expired','invalidated')),
  attempt_count int not null default 0,
  enqueued_at timestamptz not null default now(),
  last_dispatched_at timestamptz,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  invalidated_reason text,
  updated_at timestamptz not null default now()
);

create index if not exists mvp_hotdeal_queue_status_idx
  on public.mvp_hotdeal_queue (status, enqueued_at);
create index if not exists mvp_hotdeal_queue_band_profit_idx
  on public.mvp_hotdeal_queue (band desc, profit_margin desc) where status = 'available';

alter table public.mvp_hotdeal_queue enable row level security;
-- RLS deny-all: anon/authenticated SELECT/INSERT/UPDATE/DELETE 차단. service_role만 우회.

-- 2. 핫딜 reservation (한 매물 = 한 사용자 → 시간 만료 시 다음 사람).
create table if not exists public.mvp_hotdeal_reservations (
  id bigserial primary key,
  pid bigint not null,
  user_ref text not null,
  attempt_no int not null default 1,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  opened_at timestamptz,
  decided_at timestamptz,
  decision text not null default 'pending'
    check (decision in ('pending','opened','purchased','rejected','expired')),
  bunjang_sold_at timestamptz,
  notification_sent boolean not null default false,
  notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mvp_hotdeal_reservations_pid_idx on public.mvp_hotdeal_reservations (pid);
create index if not exists mvp_hotdeal_reservations_user_ref_idx on public.mvp_hotdeal_reservations (user_ref, decision);
create index if not exists mvp_hotdeal_reservations_expires_idx
  on public.mvp_hotdeal_reservations (expires_at) where decision = 'pending';
create unique index if not exists mvp_hotdeal_reservations_one_active_per_pid
  on public.mvp_hotdeal_reservations (pid) where decision = 'pending';

alter table public.mvp_hotdeal_reservations enable row level security;

-- 3. RPC: claim_next_hotdeal_for_alert (가중치 랜덤 1명 선출 + reservation 생성, atomic).
-- (이미 prod에 적용됨. idempotent 재선언.)
create or replace function public.claim_next_hotdeal_for_alert(
  p_pid bigint,
  p_window_seconds int default 900
)
returns table(
  out_reservation_id bigint,
  out_user_ref text,
  out_chat_id bigint,
  out_attempt_no int,
  out_expires_at timestamptz
)
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_expires timestamptz := v_now + make_interval(secs => p_window_seconds);
  v_attempt int;
  v_user_ref text;
  v_chat_id bigint;
  v_reservation_id bigint;
begin
  perform 1 from public.mvp_hotdeal_reservations
   where pid = p_pid and decision = 'pending' limit 1;
  if found then return; end if;

  perform 1 from public.mvp_hotdeal_queue
   where pid = p_pid and status = 'available' limit 1;
  if not found then return; end if;

  with recent_5 as (
    select t.user_ref,
      count(*) as cnt,
      count(*) filter (where t.decision in ('opened','purchased','rejected')) as responded
    from (
      select user_ref, decision,
        row_number() over (partition by user_ref order by sent_at desc) as rn
      from public.mvp_hotdeal_reservations
    ) t where t.rn <= 5
    group by t.user_ref
  ),
  last_24h as (
    select r.user_ref, count(*) as cnt
    from public.mvp_hotdeal_reservations r
    where r.sent_at >= v_now - interval '24 hours'
    group by r.user_ref
  ),
  eligible as (
    select tb.user_ref, tb.chat_id
      from public.mvp_telegram_bindings tb
      left join public.mvp_user_credits uc
        on uc.user_ref = tb.user_ref and uc.auth_user_id = tb.auth_user_id
     where tb.chat_id is not null
       and tb.paused = false
       and (uc.pro_until is null or uc.pro_until > v_now)
       and not exists (
         select 1 from public.mvp_hotdeal_reservations r2
          where r2.pid = p_pid and r2.user_ref = tb.user_ref
       )
  ),
  weighted as (
    select e.user_ref, e.chat_id,
      (case when coalesce(r.cnt,0) >= 5 and (r.responded::numeric / r.cnt) < 0.3 then 0.3 else 1.0 end)
      * (case when coalesce(l.cnt,0) >= 3 then 0.5 else 1.0 end)
      * (1.0 + random() * 0.2) as weight
    from eligible e
    left join recent_5 r on r.user_ref = e.user_ref
    left join last_24h l on l.user_ref = e.user_ref
  )
  select w.user_ref, w.chat_id
    into v_user_ref, v_chat_id
    from weighted w
   order by w.weight desc
   limit 1;

  if v_user_ref is null then return; end if;

  select coalesce(max(r.attempt_no),0)+1 into v_attempt
    from public.mvp_hotdeal_reservations r where r.pid = p_pid;

  insert into public.mvp_hotdeal_reservations(pid, user_ref, attempt_no, sent_at, expires_at)
  values (p_pid, v_user_ref, v_attempt, v_now, v_expires)
  returning id into v_reservation_id;

  update public.mvp_hotdeal_queue
     set status = 'reserved',
         attempt_count = attempt_count + 1,
         last_dispatched_at = v_now,
         updated_at = v_now
   where pid = p_pid;

  return query select v_reservation_id, v_user_ref, v_chat_id, v_attempt, v_expires;
end;
$$;
