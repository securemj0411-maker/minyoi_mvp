-- Wave 1054: fix approve_mvp_membership_application ambiguous user_ref.
-- The function returns a column named user_ref, so PL/pgSQL can treat
-- `on conflict (user_ref)` as ambiguous. Use the concrete PK constraint.

do $$
declare
  v_sql text;
  v_fixed text;
begin
  select pg_get_functiondef('public.approve_mvp_membership_application(bigint,text,uuid,integer,integer,text)'::regprocedure)
    into v_sql;

  v_fixed := replace(
    v_sql,
    'on conflict (user_ref) do update set',
    'on conflict on constraint mvp_user_plans_pkey do update set'
  );

  if v_fixed = v_sql then
    raise exception 'approve_mvp_membership_application conflict target replacement failed';
  end if;

  execute v_fixed;
end $$;

revoke all on function public.approve_mvp_membership_application(bigint, text, uuid, integer, integer, text) from public;
revoke execute on function public.approve_mvp_membership_application(bigint, text, uuid, integer, integer, text) from anon;
revoke execute on function public.approve_mvp_membership_application(bigint, text, uuid, integer, integer, text) from authenticated;
grant execute on function public.approve_mvp_membership_application(bigint, text, uuid, integer, integer, text) to service_role;

notify pgrst, 'reload schema';
