-- Wave 106: 핫딜 TTL 만료 시 자동 reroute.
-- 기존 design 결함: reservation.expires_at 지나도 decision = 'pending' 그대로 유지 →
-- claim_next_hotdeal_for_alert 가 "이미 pending 있음" 판단하고 새 사용자 못 잡음.
-- queue.status = 'reserved' 도 복원 안 됨 → dispatch loop 의 status=available 필터에서 제외 → 매물 죽음.
--
-- Fix:
-- 1. expire_stale_hotdeal_reservations() 신규 — expired pending 정리 + queue 복원
-- 2. claim_next_hotdeal_for_alert() 보강 — pending 체크에 expires_at 조건 추가 (이중 안전)
-- dispatch loop 시작에서 sweep RPC 호출 (코드 측에서).

create or replace function public.expire_stale_hotdeal_reservations()
returns table (expired_count integer, requeued_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_pids bigint[];
  v_expired integer;
  v_requeued integer;
begin
  -- 1. expired pending → 'expired' 마킹
  with x as (
    update public.mvp_hotdeal_reservations
       set decision = 'expired', updated_at = now()
     where decision = 'pending'
       and expires_at < now()
   returning pid
  )
  select array_agg(distinct pid), count(*)::integer
    into v_expired_pids, v_expired
    from x;

  -- 2. 해당 pid의 queue.status='reserved' → 'available' 복원
  --    단, 이미 다른 pending reservation 있으면 skip (race 방지)
  if v_expired_pids is not null and array_length(v_expired_pids, 1) > 0 then
    with r as (
      update public.mvp_hotdeal_queue q
         set status = 'available', updated_at = now()
       where q.pid = any(v_expired_pids)
         and q.status = 'reserved'
         and not exists (
           select 1 from public.mvp_hotdeal_reservations rr
            where rr.pid = q.pid
              and rr.decision = 'pending'
              and rr.expires_at >= now()
         )
     returning 1
    )
    select count(*)::integer into v_requeued from r;
  else
    v_requeued := 0;
  end if;

  expired_count := coalesce(v_expired, 0);
  requeued_count := coalesce(v_requeued, 0);
  return next;
end;
$$;

revoke all on function public.expire_stale_hotdeal_reservations() from public;
grant execute on function public.expire_stale_hotdeal_reservations() to service_role;

-- claim_next_hotdeal_for_alert 보강: pending 체크에 expires_at 조건 추가
create or replace function public.claim_next_hotdeal_for_alert(p_pid bigint, p_window_seconds integer default 900)
returns table (out_reservation_id bigint, out_user_ref text, out_chat_id bigint, out_attempt_no integer, out_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_expires timestamptz := v_now + make_interval(secs => p_window_seconds);
  v_attempt int;
  v_user_ref text;
  v_chat_id bigint;
  v_reservation_id bigint;
begin
  -- Wave 106: pending 체크에 expires_at 조건 추가 — expired pending이 cleanup 전이어도 새 사용자 잡기 가능
  perform 1 from public.mvp_hotdeal_reservations
   where pid = p_pid
     and decision = 'pending'
     and expires_at >= v_now
   limit 1;
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
         -- 같은 pid에 active(pending+미만료 또는 opened/purchased/rejected) reservation 있으면 skip.
         -- expired는 reroute 가능 — 이번엔 다른 사용자에게.
         select 1 from public.mvp_hotdeal_reservations r2
          where r2.pid = p_pid
            and r2.user_ref = tb.user_ref
            and (r2.decision in ('opened','purchased','rejected')
                 or (r2.decision = 'pending' and r2.expires_at >= v_now))
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
