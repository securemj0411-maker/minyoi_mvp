-- Wave 104 H2: 만료 plan 자동 다운그레이드.
-- current_period_end < now() 인 paid plan을 free로 reset (cancel_at_period_end=true 포함).
-- 호출처: housekeeper cron (1시간 주기).
-- daily_used_count도 reset → free 한도 enforcement 시작.

create or replace function public.expire_mvp_plans()
returns table (expired_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.mvp_user_plans
       set plan_key = 'free',
           status = 'expired',
           cancel_at_period_end = false,
           current_period_start = now(),
           current_period_end = null,
           daily_used_count = 0,
           daily_reset_on = current_date,
           updated_at = now()
     where plan_key in ('starter','plus','pro')
       and current_period_end is not null
       and current_period_end < now()
     returning user_ref
  )
  select count(*)::integer into v_count from expired;
  expired_count := v_count;
  return next;
end;
$$;

revoke all on function public.expire_mvp_plans() from public;
revoke execute on function public.expire_mvp_plans() from anon;
