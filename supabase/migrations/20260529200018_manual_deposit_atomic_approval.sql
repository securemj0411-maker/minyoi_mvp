-- Wave 958b (2026-05-30): manual deposit approval must be atomic.
--
-- The previous application flow read the current balance, wrote an absolute
-- new balance, then marked the request approved. Admin approval and the
-- auto-approve cron could overlap there. This RPC claims one pending request
-- and grants credits in a single database transaction.

create table if not exists public.mvp_manual_deposit_requests (
  id bigserial primary key,
  user_ref text not null,
  auth_user_id uuid not null,
  plan_key text not null,
  amount integer not null check (amount > 0),
  price_krw integer not null check (price_krw >= 0),
  depositor_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'auto_approved', 'rejected')),
  scheduled_auto_approve_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz not null default now()
);

alter table public.mvp_manual_deposit_requests enable row level security;

create index if not exists mvp_manual_deposit_requests_status_due_idx
  on public.mvp_manual_deposit_requests(status, scheduled_auto_approve_at, created_at);

create index if not exists mvp_manual_deposit_requests_auth_created_idx
  on public.mvp_manual_deposit_requests(auth_user_id, created_at desc);

alter table public.mvp_credit_ledger
  drop constraint if exists mvp_credit_ledger_event_type_check;

alter table public.mvp_credit_ledger
  add constraint mvp_credit_ledger_event_type_check
  check (event_type in (
    'free_grant',
    'pack_spend',
    'pack_refund',
    'plan_grant',
    'manual_deposit_admin_approved',
    'manual_deposit_auto_approved',
    'admin_revoke',
    'admin_block',
    'admin_unblock',
    'referral_signup_referrer',
    'referral_signup_referred',
    'referral_first_payment',
    'kakao_share_webhook'
  )) not valid;

create or replace function public.approve_mvp_manual_deposit_request(
  p_request_id bigint,
  p_decided_by text
)
returns table (
  ok boolean,
  granted boolean,
  request_id bigint,
  status text,
  new_balance integer,
  error text,
  user_ref text,
  auth_user_id uuid,
  plan_key text,
  amount integer,
  price_krw integer,
  depositor_name text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.mvp_manual_deposit_requests%rowtype;
  v_existing public.mvp_manual_deposit_requests%rowtype;
  v_status text;
  v_balance integer;
begin
  if p_decided_by not in ('admin', 'auto') then
    return query select
      false,
      false,
      p_request_id,
      null::text,
      null::integer,
      'invalid_decided_by',
      null::text,
      null::uuid,
      null::text,
      null::integer,
      null::integer,
      null::text;
    return;
  end if;

  v_status := case when p_decided_by = 'admin' then 'approved' else 'auto_approved' end;

  update public.mvp_manual_deposit_requests r
     set status = v_status,
         decided_at = now(),
         decided_by = p_decided_by
   where r.id = p_request_id
     and r.status = 'pending'
     and r.amount > 0
   returning r.* into v_request;

  if v_request.id is null then
    select r.*
      into v_existing
      from public.mvp_manual_deposit_requests r
     where r.id = p_request_id;

    if v_existing.id is null then
      return query select
        false,
        false,
        p_request_id,
        null::text,
        null::integer,
        'not_found',
        null::text,
        null::uuid,
        null::text,
        null::integer,
        null::integer,
        null::text;
      return;
    end if;

    select c.balance
      into v_balance
      from public.mvp_user_credits c
     where c.user_ref = v_existing.user_ref;

    if v_existing.status = v_status then
      return query select
        true,
        false,
        v_existing.id,
        v_existing.status,
        coalesce(v_balance, 0),
        'already_processed',
        v_existing.user_ref,
        v_existing.auth_user_id,
        v_existing.plan_key,
        v_existing.amount,
        v_existing.price_krw,
        v_existing.depositor_name;
      return;
    end if;

    return query select
      false,
      false,
      v_existing.id,
      v_existing.status,
      coalesce(v_balance, 0),
      'already_' || v_existing.status,
      v_existing.user_ref,
      v_existing.auth_user_id,
      v_existing.plan_key,
      v_existing.amount,
      v_existing.price_krw,
      v_existing.depositor_name;
    return;
  end if;

  insert into public.mvp_user_credits (
    user_ref,
    auth_user_id,
    balance,
    updated_at
  ) values (
    v_request.user_ref,
    v_request.auth_user_id,
    greatest(0, coalesce(v_request.amount, 0)),
    now()
  )
  on conflict (user_ref) do update set
    balance = public.mvp_user_credits.balance + excluded.balance,
    auth_user_id = excluded.auth_user_id,
    updated_at = now()
  returning public.mvp_user_credits.balance into v_balance;

  insert into public.mvp_credit_ledger (
    user_ref,
    auth_user_id,
    event_type,
    amount,
    balance_after,
    metadata
  ) values (
    v_request.user_ref,
    v_request.auth_user_id,
    case
      when p_decided_by = 'admin' then 'manual_deposit_admin_approved'
      else 'manual_deposit_auto_approved'
    end,
    v_request.amount,
    v_balance,
    jsonb_build_object(
      'request_id', v_request.id,
      'plan_key', v_request.plan_key,
      'price_krw', v_request.price_krw,
      'depositor_name', v_request.depositor_name,
      'decided_by', p_decided_by
    )
  );

  return query select
    true,
    true,
    v_request.id,
    v_status,
    v_balance,
    null::text,
    v_request.user_ref,
    v_request.auth_user_id,
    v_request.plan_key,
    v_request.amount,
    v_request.price_krw,
    v_request.depositor_name;
end;
$$;

revoke all on function public.approve_mvp_manual_deposit_request(bigint, text) from public;
revoke execute on function public.approve_mvp_manual_deposit_request(bigint, text) from anon;
revoke execute on function public.approve_mvp_manual_deposit_request(bigint, text) from authenticated;
grant execute on function public.approve_mvp_manual_deposit_request(bigint, text) to service_role;

notify pgrst, 'reload schema';
