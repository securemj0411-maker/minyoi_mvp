-- Wave 245 (2026-05-18): admin-approved report compensation.
--
-- User reports enter a pending review queue with zero compensation. When an
-- operator resolves the report, this RPC atomically grants the token reward
-- once and marks the report reviewed. Existing rows that were compensated by
-- the old immediate-grant flow keep their compensation and will not be paid
-- again.

create or replace function public.review_mvp_reveal_feedback_report(
  p_report_id bigint,
  p_admin_status text,
  p_admin_response_note text default '',
  p_compensation_tokens integer default 3
)
returns setof public.mvp_reveal_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.mvp_reveal_feedback%rowtype;
  v_credit public.mvp_user_credits%rowtype;
  v_status text;
  v_response_note text;
  v_grant integer;
begin
  v_status := lower(trim(coalesce(p_admin_status, '')));
  v_response_note := left(coalesce(p_admin_response_note, ''), 2000);
  v_grant := greatest(0, coalesce(p_compensation_tokens, 0));

  if v_status not in ('pending', 'resolved', 'dismissed') then
    raise exception 'invalid status';
  end if;

  select *
    into v_report
  from public.mvp_reveal_feedback
  where id = p_report_id
    and feedback_type in ('loss_report', 'inaccurate_report')
  for update;

  if not found then
    raise exception 'report not found';
  end if;

  if v_status = 'resolved'
     and coalesce(v_report.compensation_granted_tokens, 0) <= 0
     and v_grant > 0 then
    select *
      into v_credit
    from public.mvp_user_credits
    where user_ref = v_report.user_ref
    for update;

    if not found then
      raise exception 'credit row not found for report user';
    end if;

    update public.mvp_user_credits
    set balance = balance + v_grant,
        updated_at = now()
    where user_ref = v_credit.user_ref
    returning * into v_credit;

    insert into public.mvp_credit_ledger (
      user_ref,
      auth_user_id,
      event_type,
      amount,
      balance_after,
      metadata
    )
    values (
      v_credit.user_ref,
      v_credit.auth_user_id,
      'pack_refund',
      v_grant,
      v_credit.balance,
      jsonb_build_object(
        'reason', v_report.feedback_type,
        'source', 'admin_report_review',
        'report_id', v_report.id,
        'pid', v_report.pid
      )
    );

    v_report.compensation_granted_tokens := v_grant;
  end if;

  update public.mvp_reveal_feedback
  set admin_status = case when v_status = 'pending' then 'pending' else v_status end,
      admin_response_note = v_response_note,
      admin_responded_at = case when v_status = 'pending' then admin_responded_at else now() end,
      compensation_granted_tokens = case
        when v_status = 'resolved'
          then greatest(coalesce(compensation_granted_tokens, 0), coalesce(v_report.compensation_granted_tokens, 0))
        else compensation_granted_tokens
      end,
      updated_at = now()
  where id = v_report.id
  returning * into v_report;

  return next v_report;
end;
$$;

revoke all on function public.review_mvp_reveal_feedback_report(bigint, text, text, integer) from public;
revoke execute on function public.review_mvp_reveal_feedback_report(bigint, text, text, integer) from anon;
revoke execute on function public.review_mvp_reveal_feedback_report(bigint, text, text, integer) from authenticated;
grant execute on function public.review_mvp_reveal_feedback_report(bigint, text, text, integer) to service_role;
