-- 크레딧 차감 + pack_open 기록을 하나의 트랜잭션으로 묶음
-- 성공 경로에서만 호출 (amount > 0). 실패/취소는 amount=0으로 감사 기록만.
create or replace function public.spend_and_record_pack_open(
  p_user_ref       text,
  p_auth_user_id   uuid,
  p_amount         integer,
  p_band           smallint,
  p_tokens_spent   integer,
  p_tokens_refunded integer,
  p_result         text,
  p_attempted_pids integer[],
  p_revealed_pids  integer[],
  p_duration_ms    integer,
  p_metadata       jsonb default '{}'::jsonb
)
returns table(pack_open_id bigint, ok boolean, balance integer, message text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_ref   text;
  v_amount     integer;
  v_balance    integer;
  v_id         bigint;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref, '')), 64), '');
  v_amount   := greatest(0, coalesce(p_amount, 0));

  if v_user_ref is null then
    return query select null::bigint, false, 0, 'missing user ref';
    return;
  end if;

  -- 1. 크레딧 차감 (amount > 0 일 때만)
  if v_amount > 0 then
    update public.mvp_user_credits c
       set balance    = c.balance - v_amount,
           updated_at = now()
     where c.user_ref      = v_user_ref
       and c.auth_user_id  = p_auth_user_id
       and c.balance       >= v_amount
    returning c.balance into v_balance;

    if v_balance is null then
      select c.balance into v_balance
        from public.mvp_user_credits c
       where c.user_ref = v_user_ref and c.auth_user_id = p_auth_user_id;
      return query select null::bigint, false, coalesce(v_balance, 0), 'insufficient credits';
      return;
    end if;

    -- 2. 원장 기록
    insert into public.mvp_credit_ledger(
      user_ref, auth_user_id, event_type, amount, balance_after, metadata
    ) values (
      v_user_ref, p_auth_user_id, 'pack_spend', -v_amount, v_balance,
      coalesce(p_metadata, '{}'::jsonb)
    );
  else
    select c.balance into v_balance
      from public.mvp_user_credits c
     where c.user_ref = v_user_ref and c.auth_user_id = p_auth_user_id;
    v_balance := coalesce(v_balance, 0);
  end if;

  -- 3. pack_open 기록 (같은 트랜잭션)
  insert into public.mvp_pack_opens(
    user_ref, band_requested, tokens_spent, tokens_refunded, result,
    attempted_pids, revealed_pids, duration_ms, opened_at
  ) values (
    v_user_ref, p_band, p_tokens_spent, p_tokens_refunded, p_result,
    p_attempted_pids, p_revealed_pids, p_duration_ms, now()
  ) returning id into v_id;

  return query select v_id, true, v_balance, 'ok';
end;
$$;

-- 권한: service_role만 (anon/authenticated 회수)
revoke execute on function public.spend_and_record_pack_open(
  text, uuid, integer, smallint, integer, integer, text, integer[], integer[], integer, jsonb
) from public, anon, authenticated;

grant execute on function public.spend_and_record_pack_open(
  text, uuid, integer, smallint, integer, integer, text, integer[], integer[], integer, jsonb
) to service_role;
