-- Wave 106: 핫딜 권한 = Pro 전용 (정책 결정 by MJ).
-- 기존 RPC의 eligible 조건이 legacy `mvp_user_credits.pro_until` 만 봄 (Wave 104 H1 누락).
-- pro_until=null이면 통과 = free/starter/plus 모두 통과 = 정책 무력화.
-- root fix: eligible 조건을 `mvp_user_plans.plan_key='pro' AND active AND not expired` 기반으로 통일.
-- admin은 plan과 무관하게 자기 시스템 검증 가능해야 → 별도 mvp_admin_users 테이블.

create table if not exists public.mvp_admin_users (
  auth_user_id uuid primary key,
  email text,
  created_at timestamptz not null default now(),
  note text
);
alter table public.mvp_admin_users enable row level security;
revoke all on public.mvp_admin_users from public;
grant select, insert, update, delete on public.mvp_admin_users to service_role;

-- MJ admin 등록 (danshinadarina@gmail.com / auth_user_id 추출됨)
insert into public.mvp_admin_users (auth_user_id, email, note)
values ('cd77f148-b21b-405d-9734-3325f4f9dba3', 'danshinadarina@gmail.com', 'Wave 106 초기 admin (MJ)')
on conflict (auth_user_id) do nothing;

-- RPC 보강: eligible = (active pro plan) OR (admin)
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
     where tb.chat_id is not null
       and tb.paused = false
       and (
         -- Pro 활성 plan
         exists (
           select 1 from public.mvp_user_plans up
            where up.user_ref = tb.user_ref
              and up.plan_key = 'pro'
              and up.status != 'expired'
              and (up.current_period_end is null or up.current_period_end > v_now)
         )
         -- 또는 admin
         or exists (
           select 1 from public.mvp_admin_users au
            where au.auth_user_id = tb.auth_user_id
         )
       )
       and not exists (
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
