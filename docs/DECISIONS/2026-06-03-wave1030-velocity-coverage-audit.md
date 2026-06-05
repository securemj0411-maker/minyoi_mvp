# Wave 1030 — Velocity coverage audit

Date: 2026-06-03

## Trigger

피드에서 판매주기/회전률 영역이 계속 "표본 부족"처럼 보인다는 운영 피드백이 있었다.
목표는 lifecycle이 실제로 판매완료/사라짐 기록을 쓰고 있는지, 그리고 ready pool SKU 중
velocity 데이터가 어느 정도 붙어 있는지 확인하는 것이다.

## Production Findings

Full ready pool pagination 기준:

- ready rows: 7,020
- ready rows with comparable key: 7,020
- ready unique comparable keys: 1,386
- ready unique SKU ids: 655
- velocity row matched ready rows: 5,920 / 7,020 = 84.3%
- feed-usable velocity ready rows: 4,659 / 7,020 = 66.4%
- high/medium confidence velocity ready rows: 3,057 / 7,020 = 43.5%
- velocity row matched unique comparable keys: 845 / 1,386 = 61.0%
- feed-usable unique comparable keys: 477 / 1,386 = 34.4%
- velocity row matched unique SKU ids: 485 / 655 = 74.0%
- feed-usable unique SKU ids: 320 / 655 = 48.9%

Feed-usable means the current feed gate can actually show a velocity signal:

- `median_hours_to_sold > 0`
- `sold_7d_count > 0`
- `observed_sold_sample_count >= 3`

## Source / Category Pattern

Ready row feed-usable velocity coverage by source:

- Daangn: 4,053 / 5,490 = 73.8%
- Bunjang: 499 / 1,362 = 36.6%
- Joongna: 107 / 168 = 63.7%

Ready row feed-usable velocity coverage by major category:

- smartphone: 1,234 / 1,301 = 94.9%
- earphone: 629 / 632 = 99.5%
- tablet: 250 / 293 = 85.3%
- smartwatch: 368 / 427 = 86.2%
- clothing: 1,094 / 1,740 = 62.9%
- shoe: 543 / 1,472 = 36.9%
- sport_golf: 159 / 643 = 24.7%
- bag: 12 / 58 = 20.7%

## Lifecycle Health

Recent lifecycle collection is alive and writing terminal observations.

Latest inspected 24h state-change sample included:

- `lifecycle_worker:sold_confirmed`: 425
- `lifecycle_worker:disappeared`: 191
- `lifecycle_worker:missing_suspect`: 354
- `tick_detail:sold_confirmed`: 22

Last 12h lifecycle worker runs were mostly successful, but claim latency is high:

- primary lifecycle: 139 succeeded / 141 total, latest succeeded but timed out after claiming 800 and enriching 310
- B worker: 142 succeeded / 144 total
- C worker: 140 succeeded / 141 total
- observed failure pattern: Supabase REST timeout on `claim_mvp_lifecycle_checks`

## Velocity Sync Health

`sync-market-velocity` is not fully healthy for large categories.

Latest inspected run:

- succeeded overall
- duration: about 271s
- upserted: 4,542 velocity rows
- processed categories: 11
- failed categories: 2
- skipped categories due route deadline: 7

The failed categories were the important large buckets:

- `clothing`: statement timeout at 60s
- `shoe`: statement timeout at 60s

So velocity is not dead, but the current category-level sync is too coarse for large categories.

## Decision

Do not treat the current "표본 부족" UX as only a frontend copy problem.

The system has real velocity data, but the usable coverage is uneven:

- row-level coverage is acceptable for Daangn/electronics
- unique SKU-level feed-usable coverage is only 48.9%
- Bunjang, shoe, golf, and bag are weak
- clothing/shoe sync can time out and fall behind

The next sustainable fix should split velocity sync for large categories instead of muting alerts
or merely lowering UI thresholds.

## Deferred / Next Work

Recommended next wave:

1. Split velocity sync for large categories.
   - Either by source: category + source.
   - Or by stable comparable-key hash bucket.
   - Keep it upsert-only and non-destructive.
2. Inspect and add targeted indexes only after confirming the query plan.
3. Improve feed copy so 1-2 sold samples show as "거래 감지 N건 · 누적 중" instead of looking like total failure.
4. Lifecycle claim latency should be audited separately because it is alive but still slow.

## Non-Decision

- No alert threshold was loosened.
- No destructive data cleanup was performed.
- No marketplace fetch cadence was increased.
