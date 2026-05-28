# 2026-05-28 — Wave 892 Pool Source Stats Pagination

## Incident

- 운영자 풀의 `출처별 ready`에서 당근 수가 밤새 `296 -> 275`처럼 줄어든 것으로 보였다.
- Read-only 재측정 결과 실제 전체 ready는 줄어든 것이 아니었다.
  - 전체 ready: `1,386`
  - 번개장터: `773`
  - 당근: `518`
  - 중고나라: `95`
- 원인은 `/api/admin/pool-listings` stats가 `mvp_candidate_pool?limit=5000`을 호출했지만 Supabase/PostgREST server-side 1000 row cap에 걸려 앞 1000개만 집계한 것이다.

## Decision

- 운영자 풀 stats와 source filter에서 `mvp_candidate_pool` 전체 집계가 필요한 path는 `restFetchAll` pagination으로 교체한다.
- public pool-listings의 동일한 source filter / stats fetch path도 같은 pagination helper로 맞춘다.
- candidate_pool 상태, cron cadence, 외부 fetch, DB row는 변경하지 않는다. 이번 wave는 화면/집계 정확도 수정만 한다.

## Deferred

- 당근 ready 품질/통과율 개선은 별도 wave로 분리한다.
- 최근 12시간 invalidated 당근 107건의 상위 사유:
  - `sku_low_volume_below_2d1_or_7d3`: 33
  - `profit_below_pack_band`: 28
  - `profit_roi_above_45pct_weak_signal_review`: 20
  - `negative_resell_gap`: 14
- 특히 당근 raw row는 `daangn_review_count`/`daangn_manner_temperature`가 있지만 candidate pool high-profit weak-signal gate는 `shop_review_count`/`image_count` 중심이라, 당근 신뢰 신호를 별도 반영할지 후속 검토가 필요하다.

## Verification

- `npm run build` => pass
