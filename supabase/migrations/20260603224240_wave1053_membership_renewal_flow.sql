-- Wave 1053: existing members can reserve membership renewal.
-- Renewal approval extends from the current paid period end when it is still active.

alter table public.mvp_membership_applications
  add column if not exists application_kind text not null default 'new';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'mvp_membership_applications_application_kind_check'
       and conrelid = 'public.mvp_membership_applications'::regclass
  ) then
    alter table public.mvp_membership_applications
      add constraint mvp_membership_applications_application_kind_check
      check (application_kind in ('new', 'renewal'));
  end if;
end $$;

create or replace function public.approve_mvp_membership_application(
  p_application_id bigint,
  p_decision_source text,
  p_decided_by uuid,
  p_plan_months integer,
  p_price_krw integer,
  p_product_key text
)
returns table (
  ok boolean,
  activated boolean,
  application_id bigint,
  status text,
  error text,
  user_ref text,
  app_auth_user_id uuid,
  plan_key text,
  product_key text,
  price_krw integer,
  current_period_end timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_application public.mvp_membership_applications%rowtype;
  v_existing public.mvp_membership_applications%rowtype;
  v_existing_plan public.mvp_user_plans%rowtype;
  v_has_existing_plan boolean := false;
  v_now timestamptz := now();
  v_plan_months integer := greatest(1, coalesce(p_plan_months, 1));
  v_price integer;
  v_product_key text;
  v_period_start timestamptz;
  v_period_base timestamptz;
  v_period_end timestamptz;
  v_payment_key text;
begin
  if p_decision_source not in ('admin', 'telegram', 'auto') then
    return query select
      false,
      false,
      p_application_id,
      null::text,
      'invalid_decision_source',
      null::text,
      null::uuid,
      null::text,
      null::text,
      null::integer,
      null::timestamptz;
    return;
  end if;

  update public.mvp_membership_applications a
     set status = 'approved',
         decided_at = v_now,
         decided_by = p_decided_by,
         decision_source = p_decision_source,
         updated_at = v_now
   where a.id = p_application_id
     and a.status = 'pending'
   returning a.* into v_application;

  if v_application.id is null then
    select a.*
      into v_existing
      from public.mvp_membership_applications a
     where a.id = p_application_id;

    if v_existing.id is null then
      return query select
        false,
        false,
        p_application_id,
        null::text,
        'not_found',
        null::text,
        null::uuid,
        null::text,
        null::text,
        null::integer,
        null::timestamptz;
      return;
    end if;

    return query select
      true,
      false,
      v_existing.id,
      v_existing.status,
      null::text,
      v_existing.user_ref,
      v_existing.auth_user_id,
      'pro'::text,
      v_existing.product_key,
      v_existing.price_krw,
      null::timestamptz;
    return;
  end if;

  v_price := greatest(0, coalesce(p_price_krw, v_application.price_krw, 0));
  v_product_key := coalesce(nullif(trim(p_product_key), ''), v_application.product_key, 'limited_300_3mo');
  v_payment_key := 'membership_application_' || v_application.id::text;

  select p.*
    into v_existing_plan
    from public.mvp_user_plans p
   where p.user_ref = v_application.user_ref
   limit 1;
  v_has_existing_plan := found;

  if v_has_existing_plan
     and v_existing_plan.status <> 'expired'
     and v_existing_plan.current_period_end is not null
     and v_existing_plan.current_period_end > v_now then
    v_period_base := v_existing_plan.current_period_end;
    v_period_start := coalesce(v_existing_plan.current_period_start, v_now);
  else
    v_period_base := v_now;
    v_period_start := v_now;
  end if;

  v_period_end := v_period_base + make_interval(months => v_plan_months);

  insert into public.mvp_user_plans (
    user_ref,
    auth_user_id,
    plan_key,
    status,
    cancel_at_period_end,
    current_period_start,
    current_period_end,
    daily_used_count,
    daily_reset_on,
    last_payment_at,
    last_payment_amount,
    last_payment_key,
    updated_at
  ) values (
    v_application.user_ref,
    v_application.auth_user_id,
    'pro',
    'active',
    false,
    v_period_start,
    v_period_end,
    0,
    current_date,
    v_now,
    v_price,
    v_payment_key,
    v_now
  )
  on conflict (user_ref) do update set
    auth_user_id = excluded.auth_user_id,
    plan_key = 'pro',
    status = 'active',
    cancel_at_period_end = false,
    current_period_start = v_period_start,
    current_period_end = v_period_end,
    daily_used_count = 0,
    daily_reset_on = current_date,
    last_payment_at = v_now,
    last_payment_amount = v_price,
    last_payment_key = v_payment_key,
    updated_at = v_now;

  insert into public.mvp_payment_events (
    user_ref,
    auth_user_id,
    event_type,
    plan_key,
    amount,
    payment_method,
    payment_key,
    metadata,
    created_at
  ) values (
    v_application.user_ref,
    v_application.auth_user_id,
    'subscribe',
    'pro',
    v_price,
    'membership_application',
    v_payment_key,
    jsonb_build_object(
      'source', 'membership_application',
      'decision_source', p_decision_source,
      'application_id', v_application.id,
      'application_kind', v_application.application_kind,
      'product_key', v_product_key,
      'plan_months', v_plan_months,
      'period_base', v_period_base
    ),
    v_now
  )
  on conflict (payment_key) where payment_key is not null do nothing;

  return query select
    true,
    true,
    v_application.id,
    'approved'::text,
    null::text,
    v_application.user_ref,
    v_application.auth_user_id,
    'pro'::text,
    v_product_key,
    v_price,
    v_period_end;
end;
$$;

revoke all on function public.approve_mvp_membership_application(bigint, text, uuid, integer, integer, text) from public;
revoke execute on function public.approve_mvp_membership_application(bigint, text, uuid, integer, integer, text) from anon;
revoke execute on function public.approve_mvp_membership_application(bigint, text, uuid, integer, integer, text) from authenticated;
grant execute on function public.approve_mvp_membership_application(bigint, text, uuid, integer, integer, text) to service_role;

notify pgrst, 'reload schema';
