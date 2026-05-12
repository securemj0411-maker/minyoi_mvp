-- P2-1: query registry + yield-based cadence 자동 재평가.
-- env PIPELINE_SEARCH_QUERIES 정적 list 대신 DB 기반으로 query/cadence를 관리한다.
-- housekeeper가 1시간 cooldown으로 evaluator를 호출하면 cadenceFor 로직으로 자동 재평가.
-- 변경 시 cadence_log에 before/after 기록.

create table if not exists public.mvp_search_queries (
  query text primary key,
  category text not null default 'unknown',  -- queryFamily() 매핑 결과 캐시
  enabled boolean not null default true,
  cadence_minutes integer not null default 5 check (cadence_minutes in (5, 10, 30, 60)),
  mode text not null default 'gather' check (mode in ('harvest', 'gather')),
  reason text not null default 'seed',
  -- 자동 재평가 측정값 (마지막 evaluate 시점 기준)
  last_evaluated_at timestamptz,
  last_observed integer not null default 0,
  last_changed integer not null default 0,
  last_pool_any integer not null default 0,
  last_pool_ready integer not null default 0,
  -- searchStage가 마지막으로 이 query를 번개장터에 던진 시각
  last_scanned_at timestamptz,
  -- 운영자 수동 override (NULL이면 자동 갱신, 값 있으면 그 값 강제)
  cadence_override integer check (cadence_override is null or cadence_override in (5, 10, 30, 60)),
  cadence_override_expires_at timestamptz,
  cadence_override_note text,
  -- 메타
  priority smallint not null default 50,
  pack_contribution_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mvp_search_queries_due_idx
  on public.mvp_search_queries(last_scanned_at nulls first)
  where enabled = true;

create index if not exists mvp_search_queries_category_idx
  on public.mvp_search_queries(category, mode);

create table if not exists public.mvp_search_query_cadence_log (
  id bigserial primary key,
  query text not null,
  changed_at timestamptz not null default now(),
  before_cadence_minutes integer,
  after_cadence_minutes integer not null,
  before_mode text,
  after_mode text not null,
  reason text not null,
  measurement jsonb not null default '{}'::jsonb,
  source text not null default 'evaluator'  -- 'evaluator' | 'manual_override' | 'seed'
);

create index if not exists mvp_search_query_cadence_log_query_idx
  on public.mvp_search_query_cadence_log(query, changed_at desc);

create index if not exists mvp_search_query_cadence_log_changed_at_idx
  on public.mvp_search_query_cadence_log(changed_at desc);

-- searchStage가 호출하는 due query 선택용 view (선택사항, 코드에서 직접 쿼리해도 됨).
-- last_scanned_at NULL(아직 한 번도 호출 안 됨) 또는 cadence 초과한 query만.
-- cadence_override가 있으면 그 값을 effective_cadence_minutes로 노출.
create or replace view public.mvp_search_queries_due as
  select
    q.query,
    q.category,
    q.mode,
    q.reason,
    coalesce(q.cadence_override, q.cadence_minutes) as effective_cadence_minutes,
    q.last_scanned_at,
    q.priority,
    q.enabled
  from public.mvp_search_queries q
  where q.enabled = true
    and (
      q.last_scanned_at is null
      or q.last_scanned_at + make_interval(mins => coalesce(q.cadence_override, q.cadence_minutes)) <= now()
    );

-- override 만료 자동 정리(housekeeper에서 호출 가능).
create or replace function public.expire_search_query_cadence_overrides()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.mvp_search_queries
  set cadence_override = null,
      cadence_override_expires_at = null,
      cadence_override_note = null,
      updated_at = now()
  where cadence_override is not null
    and cadence_override_expires_at is not null
    and cadence_override_expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_search_query_cadence_overrides() from public;
revoke execute on function public.expire_search_query_cadence_overrides() from anon;
revoke execute on function public.expire_search_query_cadence_overrides() from authenticated;
grant execute on function public.expire_search_query_cadence_overrides() to service_role;
