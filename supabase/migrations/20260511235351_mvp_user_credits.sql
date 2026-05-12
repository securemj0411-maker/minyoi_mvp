create table if not exists public.mvp_user_credits (
  user_ref text primary key,
  auth_user_id uuid not null unique,
  balance integer not null default 0 check (balance >= 0),
  free_grant_tokens integer not null default 5 check (free_grant_tokens >= 0),
  free_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mvp_credit_ledger (
  id bigserial primary key,
  user_ref text not null,
  auth_user_id uuid not null,
  event_type text not null check (event_type in ('free_grant', 'pack_spend', 'pack_refund')),
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mvp_user_credits_auth_user_idx
  on public.mvp_user_credits(auth_user_id);

create index if not exists mvp_credit_ledger_user_idx
  on public.mvp_credit_ledger(user_ref, created_at desc);

alter table public.mvp_user_credits enable row level security;
alter table public.mvp_credit_ledger enable row level security;

create or replace function public.claim_mvp_user_credits(
  p_user_ref text,
  p_auth_user_id uuid,
  p_free_grant integer default 5
)
returns table (
  balance integer,
  free_granted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
  v_grant integer;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref, '')), 64), '');
  v_grant := greatest(0, coalesce(p_free_grant, 0));

  if v_user_ref is null then
    raise exception 'missing user ref';
  end if;

  insert into public.mvp_user_credits (
    user_ref,
    auth_user_id,
    balance,
    free_grant_tokens,
    free_granted_at
  )
  values (
    v_user_ref,
    p_auth_user_id,
    v_grant,
    v_grant,
    now()
  )
  on conflict (user_ref) do update
  set auth_user_id = excluded.auth_user_id,
      updated_at = now()
  returning public.mvp_user_credits.balance,
            public.mvp_user_credits.free_granted_at
  into balance, free_granted_at;

  if not exists (
    select 1
    from public.mvp_credit_ledger l
    where l.user_ref = v_user_ref
      and l.event_type = 'free_grant'
  ) then
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
      'free_grant',
      v_grant,
      balance,
      jsonb_build_object('source', 'claim_mvp_user_credits')
    );
  end if;

  return next;
end;
$$;

revoke all on function public.claim_mvp_user_credits(text, uuid, integer) from public;
revoke execute on function public.claim_mvp_user_credits(text, uuid, integer) from anon;
revoke execute on function public.claim_mvp_user_credits(text, uuid, integer) from authenticated;
grant execute on function public.claim_mvp_user_credits(text, uuid, integer) to service_role;

create or replace function public.spend_mvp_user_credits(
  p_user_ref text,
  p_auth_user_id uuid,
  p_amount integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  ok boolean,
  balance integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
  v_amount integer;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref, '')), 64), '');
  v_amount := greatest(0, coalesce(p_amount, 0));

  if v_user_ref is null then
    return query select false, 0, 'missing user ref';
    return;
  end if;

  if v_amount = 0 then
    return query
      select true, c.balance, 'ok'
      from public.mvp_user_credits c
      where c.user_ref = v_user_ref
        and c.auth_user_id = p_auth_user_id;
    return;
  end if;

  update public.mvp_user_credits c
  set balance = c.balance - v_amount,
      updated_at = now()
  where c.user_ref = v_user_ref
    and c.auth_user_id = p_auth_user_id
    and c.balance >= v_amount
  returning c.balance into balance;

  if balance is null then
    select c.balance
    into balance
    from public.mvp_user_credits c
    where c.user_ref = v_user_ref
      and c.auth_user_id = p_auth_user_id;

    return query select false, coalesce(balance, 0), 'insufficient credits';
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
    'pack_spend',
    -v_amount,
    balance,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query select true, balance, 'ok';
end;
$$;

revoke all on function public.spend_mvp_user_credits(text, uuid, integer, jsonb) from public;
revoke execute on function public.spend_mvp_user_credits(text, uuid, integer, jsonb) from anon;
revoke execute on function public.spend_mvp_user_credits(text, uuid, integer, jsonb) from authenticated;
grant execute on function public.spend_mvp_user_credits(text, uuid, integer, jsonb) to service_role;

create or replace function public.refund_mvp_user_credits(
  p_user_ref text,
  p_auth_user_id uuid,
  p_amount integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
  v_amount integer;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref, '')), 64), '');
  v_amount := greatest(0, coalesce(p_amount, 0));

  if v_user_ref is null then
    raise exception 'missing user ref';
  end if;

  update public.mvp_user_credits c
  set balance = c.balance + v_amount,
      updated_at = now()
  where c.user_ref = v_user_ref
    and c.auth_user_id = p_auth_user_id
  returning c.balance into balance;

  if balance is null then
    raise exception 'credit row not found';
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
    'pack_refund',
    v_amount,
    balance,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return next;
end;
$$;

revoke all on function public.refund_mvp_user_credits(text, uuid, integer, jsonb) from public;
revoke execute on function public.refund_mvp_user_credits(text, uuid, integer, jsonb) from anon;
revoke execute on function public.refund_mvp_user_credits(text, uuid, integer, jsonb) from authenticated;
grant execute on function public.refund_mvp_user_credits(text, uuid, integer, jsonb) to service_role;
