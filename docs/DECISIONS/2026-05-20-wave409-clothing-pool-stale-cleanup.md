# Wave 409 — Clothing Pool Stale Row Cleanup

Date: 2026-05-20

## Context

Wave 407-408에서 clothing category-wide ready를 닫고, 현재 parser/catalog/gate 기준으로 허용 가능한 narrow lane만 남겼다. 남은 작업은 이미 `mvp_candidate_pool`에 들어간 stale `ready` row를 실제 운영 pool에서 빼는 것이었다.

## Decisions

1. capped cleanup runner를 추가했다.
   - `scripts/cleanup-clothing-pool-stale.ts`
   - 기본값은 dry-run이다.
   - `--apply`를 줄 때만 `mvp_candidate_pool` row를 `invalidated`로 바꾼다.
   - 대상은 `category=clothing` + `status in (ready,reserved)` 중 현재 `evaluatePoolGate()` 기준으로 pool 진입이 불가능한 row다.
   - invalidation reason은 `wave408_...` prefix를 붙여 기존 lifecycle/profit invalidation과 분리했다.

2. 실제 cleanup을 적용했다.
   - dry-run: scannedRows 232, candidateRows 151
   - 대상 151개는 전부 `ready` 상태였다. `reserved` row는 없어서 사용자 예약 흐름은 건드리지 않았다.
   - apply: 151개를 `status=invalidated`, `invalidated_reason=wave408_*`, `reserved_until=null`로 업데이트했다.

3. cleanup 후 재검증했다.
   - clothing active pool: 81
   - allowedAfterCurrentGate: 81
   - blockedAfterCurrentGate: 0
   - actionableAllowedRows: 0
   - cleanup dry-run 재실행: candidateRows 0

## Applied Reason Breakdown

- `wave408_category_internal_only_clothing_lane_required`: 60
- `wave408_lane_blocked_bape_tee`: 26
- `wave408_lane_blocked_stussy_hoodie`: 20
- `wave408_lane_blocked_patagonia_retro_x`: 11
- `wave408_lane_blocked_patagonia_down`: 6
- `wave408_lane_blocked_polo_bear_collab`: 6
- `wave408_lane_blocked_tnf_supreme_collab_broad`: 4
- `wave408_lane_blocked_stussy_basic_tee`: 4
- `wave408_lane_blocked_adidas_trefoil`: 3
- `wave408_lane_blocked_polo_rrl_tee`: 3
- `wave408_lane_blocked_polo_rrl_accessory`: 2
- `wave408_lane_blocked_tnf_purple_label`: 2

## Verification

```bash
npx tsx scripts/cleanup-clothing-pool-stale.ts
npx tsx scripts/cleanup-clothing-pool-stale.ts --apply
npx tsx scripts/report-clothing-pool-purity.ts
npx tsx scripts/cleanup-clothing-pool-stale.ts
```

Post-cleanup result:

- activeClothingPoolRows: 81
- allowedAfterCurrentGate: 81
- blockedAfterCurrentGate: 0
- actionableAllowedRows: 0
- follow-up dry-run candidateRows: 0

## Deferred

- `flaggedAllowedRows` 50개는 아직 남아 있다. 이들은 대부분 stale `parsed_key_drift` / `raw_sku_now_*` 이므로 다음 score/tick reparse가 반영되면 줄어야 한다.
- if drift가 오래 남으면 별도 reparse/invalidation job으로 `mvp_listing_parsed`와 comparable key를 갱신한다.
- 다음 품질 audit은 shoe/fashion compare sample purity와 bag stale sku drift로 이어간다.
