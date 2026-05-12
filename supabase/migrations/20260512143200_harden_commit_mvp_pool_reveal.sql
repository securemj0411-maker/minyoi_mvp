-- P0-4: commit_mvp_pool_reveal에 status/reserved_until 검증을 추가.
-- 기존 RPC는 pid만 받고 무조건 exposure_count를 올렸다.
-- - status='reserved' AND reserved_until > now() 인 row만 commit.
-- - return을 void에서 boolean으로 변경 (caller가 commit 성공 여부 확인 가능).
-- user_ref 검증은 reserve_mvp_pool_candidates에서 이미 mvp_pack_reveals 중복 차단을
-- 수행하므로 commit 단에는 추가하지 않는다 (같은 request 내 reserve→commit이라 user 변경 없음).

drop function if exists public.commit_mvp_pool_reveal(bigint);

create or replace function public.commit_mvp_pool_reveal(p_pid bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.mvp_candidate_pool
  set exposure_count = exposure_count + 1,
      status = case
        when exposure_count + 1 >= max_exposure then 'spent'
        else 'ready'
      end,
      reserved_until = null,
      updated_at = now()
  where pid = p_pid
    and status = 'reserved'
    and reserved_until is not null
    and reserved_until > now();

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.commit_mvp_pool_reveal(bigint) from public;
revoke execute on function public.commit_mvp_pool_reveal(bigint) from anon;
revoke execute on function public.commit_mvp_pool_reveal(bigint) from authenticated;
grant execute on function public.commit_mvp_pool_reveal(bigint) to service_role;
