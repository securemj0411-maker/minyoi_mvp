-- Wave 104 H3: subscribe_mvp_plan 멱등성.
-- 같은 payment_key 두 번 호출 시 (네트워크 race / 사용자 새로고침) 크레딧 이중 grant 방지.
-- 1) mvp_payment_events.payment_key UNIQUE (partial — null 허용) → DB level 보장
-- 2) RPC 시작에 early return 가드 (동일 사용자 재호출이면 기존 결과 반환, 다른 사용자면 raise)

create unique index if not exists mvp_payment_events_payment_key_uniq
  on public.mvp_payment_events(payment_key) where payment_key is not null;

create or replace function public.subscribe_mvp_plan(
  p_user_ref text,
  p_auth_user_id uuid,
  p_plan_key text,
  p_credits integer,
  p_amount integer,
  p_payment_key text,
  p_period_days integer default 30
)
returns table (
  plan_key text,
  balance integer,
  current_period_end timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
  v_now timestamptz := now();
  v_period_end timestamptz;
  v_balance integer;
  v_existing record;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref,'')), 64), '');
  if v_user_ref is null then raise exception 'missing user ref'; end if;
  if p_plan_key not in ('starter','plus','pro') then
    raise exception 'invalid plan: %', p_plan_key;
  end if;

  -- H3 멱등성 가드.
  if p_payment_key is not null and length(trim(p_payment_key)) > 0 then
    select pe.user_ref, up.plan_key, up.current_period_end, uc.balance
      into v_existing
      from public.mvp_payment_events pe
      left join public.mvp_user_plans up on up.user_ref = pe.user_ref
      left join public.mvp_user_credits uc on uc.user_ref = pe.user_ref
     where pe.payment_key = p_payment_key
     limit 1;
    if found then
      if v_existing.user_ref != v_user_ref then
        raise exception 'payment_key already used by another user';
      end if;
      plan_key := coalesce(v_existing.plan_key, p_plan_key);
      balance := coalesce(v_existing.balance, 0);
      current_period_end := v_existing.current_period_end;
      return next;
      return;
    end if;
  end if;

  v_period_end := v_now + make_interval(days => greatest(1, coalesce(p_period_days, 30)));

  insert into public.mvp_user_plans (
    user_ref, auth_user_id, plan_key, status, cancel_at_period_end,
    current_period_start, current_period_end,
    daily_used_count, daily_reset_on,
    last_payment_at, last_payment_amount, last_payment_key, updated_at
  ) values (
    v_user_ref, p_auth_user_id, p_plan_key, 'active', false,
    v_now, v_period_end,
    0, current_date,
    v_now, p_amount, p_payment_key, v_now
  )
  on conflict (user_ref) do update set
    auth_user_id = excluded.auth_user_id,
    plan_key = excluded.plan_key,
    status = 'active',
    cancel_at_period_end = false,
    current_period_start = v_now,
    current_period_end = v_period_end,
    daily_used_count = 0,
    daily_reset_on = current_date,
    last_payment_at = v_now,
    last_payment_amount = p_amount,
    last_payment_key = p_payment_key,
    updated_at = v_now;

  insert into public.mvp_user_credits (user_ref, auth_user_id, balance, free_grant_tokens, free_granted_at)
  values (v_user_ref, p_auth_user_id, greatest(0, coalesce(p_credits,0)), 0, null)
  on conflict (user_ref) do update set
    balance = public.mvp_user_credits.balance + greatest(0, coalesce(p_credits,0)),
    auth_user_id = excluded.auth_user_id,
    updated_at = now()
  returning public.mvp_user_credits.balance into v_balance;

  insert into public.mvp_credit_ledger (user_ref, auth_user_id, event_type, amount, balance_after, metadata)
  values (v_user_ref, p_auth_user_id, 'plan_grant', greatest(0, coalesce(p_credits,0)), v_balance,
          jsonb_build_object('source','subscribe_mvp_plan','plan',p_plan_key,'payment_key',p_payment_key));

  -- payment_key UNIQUE 위반 시 race condition 안전망 (동시 두 번째 insert 자동 차단).
  insert into public.mvp_payment_events (user_ref, auth_user_id, event_type, plan_key, amount, payment_method, payment_key, metadata)
  values (v_user_ref, p_auth_user_id, 'subscribe', p_plan_key, coalesce(p_amount,0), 'toss_mock', p_payment_key,
          jsonb_build_object('credits',p_credits,'period_days',p_period_days));

  plan_key := p_plan_key;
  balance := v_balance;
  current_period_end := v_period_end;
  return next;
end;
$$;

revoke all on function public.subscribe_mvp_plan(text, uuid, text, integer, integer, text, integer) from public;
revoke execute on function public.subscribe_mvp_plan(text, uuid, text, integer, integer, text, integer) from anon;
