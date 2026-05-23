## Wave 728 — 운영자 화면에 신발/의류 등급 NULL placeholder (Wave 727 follow-up)

- 시간: 2026-05-23 KST
- 발견: Wave 727 측정 결과 — 신발 pool 65% / 의류 pool 79% `condition_tier` NULL. 운영자(MJ) 본인이 NULL 비율 가시화하면 backfill 진행 상황 추적 가능.

### 왜 운영자 화면만 우선

- **사용자 화면 (3곳)** 동시 fix 시도 시:
  - `pack-reveal-modal.tsx`: 다른 세션이 480줄 수정 중 (launch-78 라벨 mismatch fix) → 충돌 risk.
  - `explore-client.tsx`: ConditionTierPhotoBadge (사진 위 뱃지) 사용 → placeholder 디자인이 카드 thumbnail 위에 박혀 시각 noisy.
  - `user-reveal-dashboard.tsx`: Wave 343 코멘트 "history view = ExploreClient. UserRevealDashboard 미사용 제거" — dead component.
- **운영자 화면 (admin-pool-browser)**: 다른 세션 안 만짐 + 운영자만 보는 곳이라 디자인 자유도 큼 + 즉시 backfill 진행 확인 도구로 활용.

### 변경

- [src/components/admin-pool-browser.tsx](../../src/components/admin-pool-browser.tsx:565)
  - 기존: `{item.conditionTier && <ConditionTierChip ... />}` (NULL이면 빈 자리)
  - 새: 신발/의류 카테고리 한정 — `item.conditionTier`있으면 정상 chip, NULL이면 `등급 NULL` amber 라벨.
  - 다른 카테고리 (전자기기 등)는 영향 X.

### 검증

- `npx tsc --noEmit` — 0 error.
- 운영자가 `/admin/pool` 진입 시 신발/의류 카드에서 amber 라벨로 NULL 카드 즉시 식별 가능.
- backfill 진행하면 amber 라벨이 점진적으로 정상 chip으로 바뀜 → 진행 상황 시각 추적.

### 위험

- 운영자가 사용자 화면 noise 없이 backfill 효과 확인 가능. 사용자 영향 0.
- amber 톤은 wave 723 audit follow-up 톤 통일과 무관 (등급 NULL은 warning 의미라 amber 적절).

### 다음 (Wave 727 옵션 A/B/C 결정 대기)

1. **Backfill (옵션 A)**: 다른 세션 (clothing-axes.ts 룰 수정) 종료 후 안전 진행.
2. **Pool gate NOT NULL (옵션 B)**: candidate-pool-builder 변경 필요. Pool size 65~79% 차단 — 정책 변경.
3. **사용자 화면 placeholder (옵션 C)**: pack-reveal-modal 다른 세션 종료 후 일괄 4곳 변경.

이번 Wave 728 = 운영자 모니터링 도구만 박음. 사용자 영향 0.
