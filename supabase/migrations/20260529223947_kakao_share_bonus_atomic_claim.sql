-- Wave 962b (2026-05-30): Kakao share reward must be atomically claimed.
--
-- The app route previously read last_share_bonus_at, calculated a new balance,
-- then PATCHed an absolute balance. Two webhook deliveries could pass the
-- cooldown check together. This RPC updates the eligible credit row and writes
-- the ledger in one database transaction.

alter table public.mvp_user_credits
  add column if not exists last_share_bonus_at timestamptz;

create or replace function public.claim_mvp_kakao_share_bonus(
  p_auth_user_id uuid,
  p_amount integer default 2,
  p_chat_type text default null,
  p_hash_chat_id text default null,
  p_cooldown_hours integer default 24
)
returns table (
  ok boolean,
  granted boolean,
  user_ref text,
  balance integer,
  error text,
  last_share_bonus_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_amount integer;
  v_cooldown interval;
  v_user_ref text;
  v_balance integer;
  v_last_share_bonus_at timestamptz;
begin
  v_amount := greatest(0, coalesce(p_amount, 0));
  v_cooldown := make_interval(hours => greatest(1, coalesce(p_cooldown_hours, 24)));

  if p_auth_user_id is null then
    return query select false, false, null::text, 0, 'missing_auth_user_id', null::timestamptz;
    return;
  end if;

  if v_amount <= 0 then
    return query select false, false, null::text, 0, 'invalid_amount', null::timestamptz;
    return;
  end if;

  update public.mvp_user_credits c
     set balance = c.balance + v_amount,
         last_share_bonus_at = now(),
         updated_at = now()
   where c.auth_user_id = p_auth_user_id
     and (
       c.last_share_bonus_at is null
       or c.last_share_bonus_at <= now() - v_cooldown
     )
   returning c.user_ref, c.balance, c.last_share_bonus_at
    into v_user_ref, v_balance, v_last_share_bonus_at;

  if v_user_ref is null then
    select c.user_ref, c.balance, c.last_share_bonus_at
      into v_user_ref, v_balance, v_last_share_bonus_at
      from public.mvp_user_credits c
     where c.auth_user_id = p_auth_user_id;

    if v_user_ref is null then
      return query select false, false, null::text, 0, 'user_not_found', null::timestamptz;
      return;
    end if;

    return query select true, false, v_user_ref, coalesce(v_balance, 0), 'cooldown', v_last_share_bonus_at;
    return;
  end if;

  insert into public.mvp_credit_ledger (
    user_ref,
    auth_user_id,
    event_type,
    amount,
    balance_after,
    metadata
  )
  values (
    v_user_ref,
    p_auth_user_id,
    'kakao_share_webhook',
    v_amount,
    v_balance,
    jsonb_build_object(
      'source', 'kakao_webhook',
      'chat_type', nullif(left(coalesce(p_chat_type, ''), 80), ''),
      'hash_chat_id', nullif(left(coalesce(p_hash_chat_id, ''), 160), '')
    )
  );

  return query select true, true, v_user_ref, v_balance, null::text, v_last_share_bonus_at;
end;
$$;

revoke all on function public.claim_mvp_kakao_share_bonus(uuid, integer, text, text, integer) from public;
revoke execute on function public.claim_mvp_kakao_share_bonus(uuid, integer, text, text, integer) from anon;
revoke execute on function public.claim_mvp_kakao_share_bonus(uuid, integer, text, text, integer) from authenticated;
grant execute on function public.claim_mvp_kakao_share_bonus(uuid, integer, text, text, integer) to service_role;
