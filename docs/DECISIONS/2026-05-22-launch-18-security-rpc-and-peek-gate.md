# 2026-05-22 — Launch HIGH security batch: RPC anon EXECUTE + peek-pool 게이트

## #1 Supabase RPC anon/PUBLIC EXECUTE 회수
**audit 짚음**: 16~17개 SECURITY DEFINER RPC 가 anon key 로 직접 호출 가능.

**가장 위험 (CRITICAL 수준)**:
- `delete_user_account(text, uuid)` — 누구나 user_ref + auth_user_id 알면 계정 삭제 호출
- `claim_next_hotdeal_for_alert` — hotdeal claim 우회
- `consume_mvp_daily_quota` / `refund_mvp_daily_quota` — quota 차감 / 환급 우회
- `reactivate_mvp_plan` — plan 재활성화 우회

**3 단계 migration**:
1. `launch-18`: REVOKE FROM anon, authenticated (16개 RPC)
2. `launch-18.b`: overload 함수 정확 signature (claim_next + reserve_mvp overload)
3. `launch-18.c`: **REVOKE FROM PUBLIC** — anon/authenticated 가 PUBLIC 통해 grant 됐던 거 회수

서버 측 = service_role key 사용 → 영향 X (service_role 은 모든 권한 보유).

**검증**: 모든 비즈니스 RPC anon_exec=false 확인.

## #2 /peek-pool-7f3kz9 인증 게이트
**audit 짚음**: 베타 테스터용 obscurity URL — URL 유출 시 풀 전체 (수익 차익, profit_band,
confidence) 노출. 경쟁자 비즈니스 데이터 수집 risk.

**fix**:
- `/api/public/pool-listings` GET 시작에 `requireSupabaseUser` + `isAdminUser || isBetaTesterAuthId` 가드
- 미인증 또는 권한 없으면 `404 not_found` (existence 자체 숨김)
- page.tsx 는 그대로 — API 가 404 반환하면 페이지 fetch 실패

## 영향
- DB: 3 migration (additive 권한 회수)
- 코드: 1 파일 (route.ts)
- UI: peek-pool 페이지 자체는 admin/beta 만 데이터 받음. 나머지 사용자 = 빈 화면 or 에러.

## 메모리 룰
- 일반인 친화: 사용자 데이터 보호 (delete_user_account 익명 호출 차단)
- decision log: 이 파일
- DELETE/DROP 룰: 권한 회수 (additive 보안). 데이터 손실 X.

## 후속 (필요 시)
- Security Definer Views 8개 review (advisor security_definer_view)
- function_search_path_mutable 3개 (search_path 명시)
- 별 audit 사이클에서.
