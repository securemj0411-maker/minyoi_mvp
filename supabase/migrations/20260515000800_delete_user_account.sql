-- Wave 106: 회원 탈퇴 / 데이터 삭제 흐름 (한국 개인정보보호법 의무).
-- 정책: 익명화 (anonymize) — 통계/회계 데이터는 user_ref를 anon_<random>로 바꾸고 auth_user_id NULL.
--   개인 식별 데이터 (telegram, credits, plans) 는 row 자체 삭제.
-- supabase auth.users 자체 삭제는 별도 server-side admin API (이 RPC 후 호출).

create or replace function public.delete_user_account(p_user_ref text, p_auth_user_id uuid)
returns table (anonymized_count integer, deleted_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon_ref text := 'deleted_' || substring(md5(random()::text || clock_timestamp()::text), 1, 16);
  v_anon integer := 0;
  v_deleted integer := 0;
  v_count integer;
begin
  if p_user_ref is null or trim(p_user_ref) = '' then
    raise exception 'missing user ref';
  end if;
  if p_auth_user_id is null then
    raise exception 'missing auth user id';
  end if;

  -- 1. 개인 식별 row 삭제 (telegram / credits / plans / admin / actions)
  delete from public.mvp_telegram_bindings where user_ref = p_user_ref or auth_user_id = p_auth_user_id;
  get diagnostics v_count = row_count; v_deleted := v_deleted + v_count;

  delete from public.mvp_user_credits where user_ref = p_user_ref or auth_user_id = p_auth_user_id;
  get diagnostics v_count = row_count; v_deleted := v_deleted + v_count;

  delete from public.mvp_user_plans where user_ref = p_user_ref or auth_user_id = p_auth_user_id;
  get diagnostics v_count = row_count; v_deleted := v_deleted + v_count;

  delete from public.mvp_admin_users where auth_user_id = p_auth_user_id;
  get diagnostics v_count = row_count; v_deleted := v_deleted + v_count;

  delete from public.mvp_user_candidate_actions where user_id = p_auth_user_id;
  get diagnostics v_count = row_count; v_deleted := v_deleted + v_count;

  -- 2. 통계/회계 row 익명화 (회계 보존 + 개인 식별 X)
  update public.mvp_credit_ledger set user_ref = v_anon_ref, auth_user_id = null
   where user_ref = p_user_ref or auth_user_id = p_auth_user_id;
  get diagnostics v_count = row_count; v_anon := v_anon + v_count;

  update public.mvp_payment_events set user_ref = v_anon_ref, auth_user_id = null
   where user_ref = p_user_ref or auth_user_id = p_auth_user_id;
  get diagnostics v_count = row_count; v_anon := v_anon + v_count;

  update public.mvp_pack_opens set user_ref = v_anon_ref where user_ref = p_user_ref;
  get diagnostics v_count = row_count; v_anon := v_anon + v_count;

  update public.mvp_pack_reveals set user_ref = v_anon_ref where user_ref = p_user_ref;
  get diagnostics v_count = row_count; v_anon := v_anon + v_count;

  update public.mvp_reveal_feedback set user_ref = v_anon_ref where user_ref = p_user_ref;
  get diagnostics v_count = row_count; v_anon := v_anon + v_count;

  update public.mvp_hotdeal_reservations set user_ref = v_anon_ref where user_ref = p_user_ref;
  get diagnostics v_count = row_count; v_anon := v_anon + v_count;

  anonymized_count := v_anon;
  deleted_count := v_deleted;
  return next;
end;
$$;

revoke all on function public.delete_user_account(text, uuid) from public;
grant execute on function public.delete_user_account(text, uuid) to service_role;
