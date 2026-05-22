# 2026-05-22 — Launch CRITICAL #1: mvp_incident_log RLS 미적용 fix

## 배경
런칭 직전 보안 audit (5 agent 병렬) 결과 CRITICAL 1번 항목.
Supabase advisor `rls_disabled_in_public` 짚음 — `mvp_incident_log` 만 RLS 꺼져있고
anon 사용자에게 SELECT/INSERT/UPDATE/DELETE 권한 풀 부여.

## 위험
- 브라우저 노출 anon key 만 알면 `last_context` jsonb 안 운영 내부 정보 노출
- 익명 사용자가 incident row 위변조 / 삭제 가능
- 다른 40개 `mvp_*` 테이블은 RLS 켜져있는데 이것만 누락

## 적용 (Migration: `enable_rls_mvp_incident_log_wave_launch_1`)
```sql
ALTER TABLE public.mvp_incident_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mvp_incident_log FROM anon;
REVOKE ALL ON public.mvp_incident_log FROM authenticated;
```

## 영향 분석
- `mvp_incident_log` 접근 코드 = `src/app/api/cron/incident-watch/route.ts` 1곳
- 거기서 `serviceHeaders()` (service_role key) 사용 → RLS 우회. 동작 영향 X
- anon key 로 incident_log 접근하는 client 코드 0건 (grep 확인)
- PITR 미박힘 룰 — 단 RLS ENABLE / REVOKE 는 데이터 변경 아니라 권한만. row 그대로

## 검증
- `pg_class.relrowsecurity` = true (확인)
- `information_schema.role_table_grants` — service_role 만 7 privileges 보유,
  anon / authenticated 권한 0건 ✓

## 관련
- Launch audit 결과 — `docs/DECISIONS/2026-05-22-launch-audit-summary.md` (예정)
- 메모리 룰: DELETE/DROP 사전 영향 명시 + confirm 준수
