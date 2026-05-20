# Wave 410 — Fashion Pool Gate Cleanup

Date: 2026-05-20

## Context

Wave 409에서 clothing stale pool row를 정리한 뒤, fashion 전체 pool(`shoe`, `clothing`, `bag`)에 아직 gate 기준으로 막혀야 하는 row가 남아 있는지 확인했다. 목표는 사용자에게 바로 노출되는 `mvp_candidate_pool status in (ready,reserved)`만 우선 감사하는 것이었다.

## Decisions

1. pool-only purity report를 추가했다.
   - `scripts/report-fashion-pool-purity.ts`
   - active fashion pool row만 대상으로 current catalog/parser/gate를 replay한다.
   - raw 전체 sweep보다 빠르고, 사용자 노출 리스크를 우선 확인할 수 있다.

2. generic fashion pool gate cleanup runner를 추가했다.
   - `scripts/cleanup-fashion-pool-gate-blocked.ts`
   - 기본은 dry-run이다.
   - `--apply`를 줄 때만 `mvp_candidate_pool` row를 `invalidated`로 바꾼다.
   - current `evaluatePoolGate()` 기준으로 막히는 row를 `wave410_*` reason으로 분리한다.
   - `--extra-pids`는 false-positive catalog row를 수동 cleanup할 때만 쓴다.

3. shoe stale pool row 25개를 정리했다.
   - 원인: `shoe` category가 `internal_only`인데 과거 category-ready 시절/no-lane SKU가 pool에 남아 있었다.
   - 예: Dunk broad/color variants, Gazelle broad, Dr.Martens 2976/1460, NB 990v6/992, Hoka Bondi 9, Salomon RX Slide broad.
   - 이 row들은 public-ready laneKey가 없으므로 lane 승격이 아니라 invalidation이 맞다.

4. BaoBao/Issey Miyake false positive를 보강하고 1개 stale bag row를 정리했다.
   - `bag-baobao-issey-miyake-lucent`가 "이세이 미야케 맨 ... 레더 스니커"를 bag으로 흡수했다.
   - `mustNotContain`에 `스니커`를 추가했다.
   - 기존 pool row `pid=320836392`는 `wave410_baobao_sneaker_false_positive`로 invalidated 처리했다.

5. report category-conflict heuristic을 보정했다.
   - `벨트백`, `힙색`, `슬링백`, `보관 가방`, `더스트백`, `슈즈백`, `의류/잡화` 같은 문구는 product category contamination으로 보지 않는다.
   - 룰루레몬 벨트백과 푸마 축구화 구성품 가방 같은 정상 매물이 actionable으로 뜨지 않도록 했다.

6. stale comparable key row도 pool에서 제거했다.
   - pack open은 `mvp_candidate_pool.comparable_key`로 market stats와 비교매물 basis를 가져온다.
   - gate는 통과해도 old key가 남아 있으면 비교매물 섹션이 예전 product-type 없는 key로 섞일 수 있다.
   - `--include-key-drift` dry-run에서 72개를 확인했고, 모두 `wave410_pool_key_drift`로 invalidated 처리했다.
   - 다음 score/tick이 current parser key와 current profit으로 다시 진입시키는 것이 update-in-place보다 안전하다.

## Applied Impact

Gate cleanup apply:

- scannedRows: 150
- candidateRows: 26
- applied: 26
- shoe invalidated: 25
- bag invalidated: 1

Key drift cleanup apply:

- scannedRows: 124
- candidateRows: 72
- applied: 72
- clothing invalidated: 51
- bag invalidated: 14
- shoe invalidated: 7

Post-cleanup fashion pool purity:

- activeFashionPoolRows: 52
- clothing: 30
- bag: 13
- shoe: 9
- gateBlockedRows: 0
- flaggedRows: 2
- actionableRows: 0

## Verification

```bash
npx tsx scripts/report-fashion-pool-purity.ts
npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --extra-pids=320836392 --extra-reason=wave410_baobao_sneaker_false_positive
npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply --extra-pids=320836392 --extra-reason=wave410_baobao_sneaker_false_positive
npx tsx scripts/report-fashion-pool-purity.ts
npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts
npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --include-key-drift
npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --apply --include-key-drift
npx tsx scripts/report-fashion-pool-purity.ts
npx tsx scripts/cleanup-fashion-pool-gate-blocked.ts --include-key-drift
```

Final dry-run candidateRows: 0.

## Deferred

- Remaining active fashion pool은 52개로 줄었다. quantity보다 precision을 우선했다.
- Remaining `flaggedRows` 2개는 current catalog rejection drift(`raw_sku_now_null`)이고 actionable cleanup candidate는 아니다. 다만 Bottega current-catalog rejection처럼 raw SKU를 아직 신뢰하는 부분은 별도 stale SKU reparse/backfill wave로 다룬다.
- Remaining shoe pool 9개는 laneKey ready row다. 다음 audit은 이 9개 shoe lane의 sample purity를 좁게 본다.
