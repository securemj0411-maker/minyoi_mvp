# Wave 66 — camera category readiness ready → internal_only 되돌림

> Status: **applied (DB write 1 row).** code 0, DDL 0, candidate_pool 0, public 0. autonomy 행동 (owner Wave 65 옵션 A 확정 후속).

CLAUDE.md 6 필드 포맷.

## 0.1 camera readiness revert

- 시간: 2026-05-14 01:52 KST
- 발견: Wave 65에서 camera narrow lane `body_only_exact_model` 정책 옵션 A (정확성 유지, recall 손해 수용) 확정. 그 후 DB `mvp_category_readiness` 측정에서 **camera status='ready'** 발견 — 그러나 pool ready=0 (Wave 65에서 측정한 detail-skip 92% 결과). 즉 ready 카테고리인데 후보 0건 = 사용자 UI에 빈 카메라 카테고리 노출 가능. mismatch.
- 변경:
  - DB `mvp_category_readiness` UPDATE: `category='camera'` status `ready` → `internal_only` (Wave 66 timestamp)
  - `CLAUDE.md` Category Readiness 섹션 갱신: ready 9→8, internal_only 2→3 (camera 추가), Wave 65 메모 → Wave 66 결과 메모로 교체
- 검증:
  - `update ... returning *` 1 row 변경 확인 (camera, internal_only, 2026-05-14 01:52:41.083245+00)
  - 나머지 8 ready / 2 internal_only (smartphone/game_console) / 1 blocked (small_appliance) 무변동
- 위험:
  - 매우 낮음. 시세 학습은 internal_only에서도 계속됨. 사용자 노출만 차단.
  - 추후 catalog body-only lane 정책 변경 시 ready로 다시 돌리면 됨 (DB UPDATE 1줄).
  - frontend가 ready 카테고리 enum hardcode 가정 있을 수 있음 — 검토 필요 (category-readiness.ts:loadCategoryReadinessMap이 DB 동적 로드라 자동 반영, frontend는 보통 server-side render → 다음 ISR 재생성 시 적용).
- 다음:
  - 자연 다음 ISR 후 landing/dashboard에서 camera 카테고리 노출 사라지는 것 확인.
  - 카메라 lane 정책 변경 (옵션 B/C) 결정 시 다시 ready 승격.

## 1. 남은 owner 결정

| # | 사안 | 권장 |
|---|---|---|
| 1 | mvp_search_queries 22 drift cleanup | 보류 (risk 중, reward 미미) |
| 2 | deep-crawl cron ON | owner (비용 vs long-tail) |
| 3 | bose-qc45 duplicate SKU 정리 | 보류 (reward 미미) |
| 4 | 사업 카테고리 신규 (시계/골프/카메라 broad) | owner |
