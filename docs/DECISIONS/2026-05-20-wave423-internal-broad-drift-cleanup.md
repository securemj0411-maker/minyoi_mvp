# 2026-05-20 Wave423 - Internal Broad Drift Cleanup

## Context
- Wave422 이후 full 30-day fashion sweep은 14,817 raw rows replay 단계에서 런타임이 과해 중단했다.
- 대신 다음 오염 후보를 lane-filtered로 좁혀 Champion/Thom Browne/Carhartt/CDG clothing broad와 Thom Browne/CDG bag broad를 점검했다.
- 이 lane들은 대부분 internal-only broad라 공개 풀에 바로 들어가면 안 되며, stale parser/key drift가 쌓여도 pool purity에 영향이 없는지 확인하는 것이 목적이었다.

## Decisions
- `bag-thombrowne-broad`로 남아 있던 쇼핑백 단품은 비교군에서 제외했다.
- `bag-thombrowne-broad`로 남아 있던 "톰브라운 밀라노스티치 백화점판 3버튼"은 가방이 아니므로 비교군에서 제외했다. Title-only 기준으로 clothing broad 확신도 낮아 보수적으로 `sku_id=null` 처리했다.
- Champion broad internal-only row 1개는 공개 ready lane이 아니므로 `score_dirty=false`로 queue에서 내렸다.
- Broad clothing rows의 product type drift(hoodie vs tee, hoodie_zip, polo_shirt 등)는 ready 공개 lane이 아니므로 DB raw SKU rematch 대상이 아니라 다음 parser/key backfill wave로 보류했다.

## DB Cleanup Applied
- `pid=395183733` 톰브라운 쇼핑백:
  - `bag-thombrowne-broad -> null`
  - `pool_eligible=false`
- `pid=399449663` 톰브라운 밀라노스티치 백화점판 3버튼:
  - `bag-thombrowne-broad -> null`
  - `pool_eligible=false`
- `pid=396362339` Champion broad internal-only dirty row:
  - `score_dirty=false`

## Verification
- Lane-filtered sweep after cleanup:
  - raw rows 713
  - `rawSkuRejectedByCurrentCatalog`: 0
  - `rawSkuDiffersFromCurrentCatalog`: 0
  - `dbCleanButCurrentCatalogRejects`: 0
  - `poolExposedWithDrift`: 0
  - `topRawSkuMismatch`: []
- `report-fashion-dirty-queue --scorable-only` final:
  - loadedDirtyFashionRows 0
  - scorableReadyRows 0
  - rawCurrentMismatchRows 0
- `report-fashion-pool-purity` final:
  - activeFashionPoolRows 53
  - gateBlockedRows 0
  - flaggedRows 0
  - actionableRows 0
- Regression bundle after Wave422/Wave423:
  - 274 pass / 0 fail

## Deferred
- Champion/Thom Browne/Carhartt/CDG broad product-type key drift remains a parser/backfill concern, not a ready exposure issue.
- Next targeted sweeps should avoid full 30-day all-fashion replay and instead use lane filters by high-risk internal broad families.
