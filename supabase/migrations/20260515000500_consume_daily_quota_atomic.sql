-- Wave 106: consume_mvp_daily_quota race fix.
-- 기존 RPC (schema.sql:2107) 는 SELECT 후 IF check 후 UPDATE 분리 구조라 TOCTOU race.
-- 동시 두 요청이 SELECT를 같이 통과 → 둘 다 UPDATE → daily_used_count = limit + 1 가능.
-- 무료 사용자 1회 한도 → 2회 사용으로 1팩 분 비용 누출.
--
-- Fix: single conditional UPDATE with WHERE daily_used_count < limit.
-- postgres가 row-level lock + WHERE re-evaluation 을 atomic하게 처리해서 race 차단.

create or replace function public.consume_mvp_daily_quota(
  p_user_ref text,
  p_auth_user_id uuid,
  p_limit integer
)
returns table (ok boolean, used integer, daily_limit integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
  v_today date := current_date;
  v_current integer;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref,'')), 64), '');
  if v_user_ref is null then raise exception 'missing user ref'; end if;

  if p_limit < 0 then
    ok := true; used := 0; daily_limit := -1; message := 'unlimited';
    return next; return;
  end if;
  if p_limit = 0 then
    ok := false; used := 0; daily_limit := 0; message := 'no_plan';
    return next; return;
  end if;

  -- 신규 user면 row 생성
  insert into public.mvp_user_plans (user_ref, auth_user_id, plan_key, status, daily_used_count, daily_reset_on)
  values (v_user_ref, p_auth_user_id, 'free', 'active', 0, v_today)
  on conflict (user_ref) do nothing;

  -- 날짜 바뀌면 reset (다른 트랜잭션과 race 가능하지만 reset은 idempotent — daily_used_count=0)
  update public.mvp_user_plans p
  set daily_used_count = 0, daily_reset_on = v_today, updated_at = now()
  where p.user_ref = v_user_ref and p.daily_reset_on <> v_today;

  -- ★ atomic conditional update. WHERE에 limit 체크 같이 넣어서 race 차단.
  --   postgres는 row lock 잡고 WHERE 재평가 → 동시 요청 직렬화됨.
  --   limit 도달한 row는 update 매칭 X → not found → reject.
  update public.mvp_user_plans p
  set daily_used_count = daily_used_count + 1, updated_at = now()
  where p.user_ref = v_user_ref
    and p.daily_used_count < p_limit
    and p.daily_reset_on = v_today
  returning p.daily_used_count into v_current;

  if not found then
    -- limit 초과 또는 reset_on mismatch (희박). 현재 used 다시 읽어서 반환.
    select daily_used_count into v_current
    from public.mvp_user_plans where user_ref = v_user_ref;
    ok := false;
    used := coalesce(v_current, 0);
    daily_limit := p_limit;
    message := 'daily_limit_reached';
    return next; return;
  end if;

  ok := true; used := v_current; daily_limit := p_limit; message := 'ok';
  return next;
end;
$$;

revoke all on function public.consume_mvp_daily_quota(text, uuid, integer) from public;
grant execute on function public.consume_mvp_daily_quota(text, uuid, integer) to service_role;
