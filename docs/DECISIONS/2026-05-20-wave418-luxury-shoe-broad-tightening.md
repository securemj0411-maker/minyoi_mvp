# 2026-05-20 Wave 418 - Luxury Shoe Broad Tightening

## Decision
- 공개 `LANE_READINESS`는 늘리지 않고, luxury shoe broad 내부에서 반복 확인된 모델만 catalog-only 후보로 분리했다.
- `shoe-balenciaga-track-broad`는 Track Sandal / Tractor Chelsea boot를 흡수하지 않게 차단했다.
- `shoe-balenciaga-runner-broad`에서 `shoe-balenciaga-3xl`을 분리했다.
- `shoe-gucci-broad`에서 Rhyton 오타형 `롸이톤`과 `shoe-gucci-tennis-1977`을 분리했다.
- `shoe-prada-broad`에서 `shoe-prada-america-cup`을 분리했다.
- `shoe-hermes-broad`에서 `shoe-hermes-egerie`, `shoe-hermes-izmir`를 분리했다.

## Applied DB Rematch
- 대상 broad row 166건을 current catalog로 replay했다.
- raw SKU 변경 22건을 제한 적용했다.
  - `shoe-hermes-broad -> shoe-hermes-egerie`: 3
  - `shoe-prada-broad -> shoe-prada-america-cup`: 4
  - `shoe-gucci-broad -> shoe-gucci-rhyton`: 2
  - `shoe-gucci-broad -> shoe-gucci-tennis-1977`: 3
  - `shoe-balenciaga-track-broad -> null`: 3
  - `shoe-hermes-broad -> shoe-hermes-izmir`: 3
  - `shoe-balenciaga-runner-broad -> shoe-balenciaga-3xl`: 4
- null 전환 3건은 Track Sandal / Tractor Chelsea boot라 score queue에 남기지 않았다.
- non-null 전환 row는 score dirty로 태운 뒤 score stage를 1회 실행했다.

## Verification
- Score drain 결과: scored 26, poolUpserted 0, poolSkipped 26, score_dirty_cleared_rows 28.
- Shadow audit은 비활성화했지만 기존 score AI review 경로에서 AI API call 4건이 발생했다.
- `report-fashion-dirty-queue --scorable-only`: loadedDirtyFashionRows 0.
- `report-fashion-pool-purity`: activeFashionPoolRows 48, flaggedRows 0, actionableRows 0.
- `cleanup-fashion-pool-gate-blocked --include-key-drift`: candidateRows 0.
- Target broad replay after apply: scanned 144, remainingChanges 0.
- Related regression suite: 259 pass, 0 fail.

## Deferred
- Balenciaga Track Sandal, Hermes Jet/Volt/Boomerang, Gucci Screener, LV Rivoli/Timeout, Prada Downtown/Linea Rossa 등은 sample이 아직 작거나 variant spread가 커서 이번 wave에서는 catalog-only 후보로 추가하지 않았다.
- 새 후보들은 모두 internal-only 상태이며 public ready 승격은 별도 purity/sample 검증 후 결정한다.
