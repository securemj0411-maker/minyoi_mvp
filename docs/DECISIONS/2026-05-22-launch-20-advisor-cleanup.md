# 2026-05-22 — Launch advisor cleanup batch

Supabase advisor (`get_advisors security`) 전수 검사 후 일괄 처리.

## 처리한 issue

### ERROR — Security Definer View 7개 권한 회수
- `v_mvp_candidate_pool_audit_status`
- `mvp_listing_ai_cache_retention_v1`
- `v_mvp_ai_l2_cost_daily`
- `v_mvp_ai_l2_cache_hit_rate`
- `v_mvp_ai_l2_coverage_daily`
- `v_mvp_ai_l2_coverage_monthly`
- `mvp_search_queries_due`

→ `REVOKE ALL FROM anon, authenticated`. service_role 만 접근. RLS 우회 view 안 익명 노출 차단.

### WARN — Function search_path 명시 2개
- `set_updated_at_on_learning_queue()` — trigger 함수
- `touch_pending_patches_updated_at()` — trigger 함수

→ `SET search_path = public, pg_temp`. schema injection 방어.

### WARN — `expire_mvp_plans()` authenticated EXECUTE 회수
- 이전: signed-in 사용자가 plan expire 우회 가능
- 현재: `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`. service_role 만.

## Migration
`launch_20_advisor_warns_and_view_grants`

## 남은 advisor
- **37개 INFO (`rls_enabled_no_policy`)**: Supabase 정상 패턴. RLS 켜져 있고 policy 없음 = service_role 만 접근. 의도된 동작 (RLS 통한 anon/authenticated 차단). 무시.
- **1개 WARN (`auth_leaked_password_protection`)**: 사용자 대시보드 액션 필요.
  → Supabase → Authentication → Providers → Email → "Prevent use of compromised passwords" 체크.

## 영향
- 서버 (service_role) 동작 X
- anon/authenticated 가 view / function 직접 호출하던 코드 0건 (검증 완료, launch-18 와 동일)

## 메모리 룰
- decision log: 이 파일
- DELETE/DROP 룰: 권한 회수 (additive 보안). 데이터 손실 X.
