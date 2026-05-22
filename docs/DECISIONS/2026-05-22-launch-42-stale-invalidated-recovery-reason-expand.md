# 2026-05-22 — launch-42: stale invalidated 재평가 cron 사유 whitelist 확장 (fashion 한정)

## 사용자 짚음
> "profit_below_pack_band 685건이 제일 크니까?? 파레토의 법칙으로 이거먼저 해야되는거아님??? 카테고리제한은 지금 의미가 있음 파서 강화중임 나머지 너가 할수있는거 다 해야될듯"
>
> "이거는 그냥 애초에 돈 안되는거도 여기로 가는거 말한거임? 아니면 ready였다가 invalidated된거 말하는거임?? 후자면 진짜 좋은데 전자면 애초에 비싼 매물이여서 별 큰 효과는 없긴할듯 cron돌긴돌아도"

## 검증 (DB SQL)

### profit_below_pack_band 1,530건 = **100% ready→invalidated 전환**
- **100% (1530/1530) had_last_verified_at** = 한 번 이상 ready 였던 매물
- 99.7% (1525/1530) added 후 5분+ 지나서 invalidate (즉시 cut 아님)
- 평균 transition 시간 = **47시간**
- 44건은 사용자에게 노출까지 됐던 매물

### stale 24h+ active 685건 = 100% had_ready_moment
- 사용자 paretto 추측 정확: "후자 (ready 였다가 invalidated)" 100%
- ingest 시 차익 OK → ready → 47h 후 시세 변동/셀러 가격 인상 → invalidate → raw 여전히 active → 영구 잠금

## root cause

`src/lib/tick-pipeline.ts:4169` `markRecoveredMarketInvalidatedPoolRowsDirty` cron:
```sql
status=eq.invalidated
  AND category=in.(clothing,shoe,bag)        ← fashion 만
  AND invalidated_reason=eq.sku_median_unavailable  ← 한 사유만
```

→ fashion + sku_median_unavailable 한 케이스만 재평가. 다른 사유 + 다른 카테고리 영구 잠금.

DB 검증: invalidated + raw active 2,763건 중 **2,313건이 score_dirty=false** (영영 재평가 안 되는 매물).

## fix (사용자 지시대로)

- **카테고리 제한 유지** (clothing/shoe/bag) — 다른 카테고리는 파서 강화 진행 중 (다른 세션)
- **invalidated_reason whitelist 확장** — 회복 가능 사유 22종 포함

### 회복 가능 사유 (whitelist 추가)
- **시세/가격 변동**: `sku_median_unavailable` (기존), `wave99_thin_market_n_lt_5`, `profit_below_pack_band`, `negative_resell_gap`
- **raw 복구**: `pool_eligible_false_residue`
- **parser/policy stale**: `wave410_pool_key_drift`, `wave408/410_*_lane_required`, `wave410_category_internal_only_*`, `wave498/500/501_stale_*`, `wave226_wrong_sku_match_cleanup`, `wave230_sku_id_null_stale`, `stale_parser_version_*_residue`
- **AI/검토 가치**: `blocked_deep_discount_review`, `fashion_unknown_condition_review`, `fashion_broad_sku_review`

### 회복 불가 사유 (whitelist 제외 — 의도적 차단)
- `lifecycle_state_*` (매물 사라짐)
- `num_comment_above_8` (인기 매물 의도 차단)
- `seller_rating_below_3_5_review` (셀러 신뢰 정책)
- `multi_id_fraud_group_*` / `fake_suspect_*` (사기/가품 의심)
- `ad_or_retail_listing` (광고)
- `category_*_blocked` / `lane_blocked_*` (운영 정책)
- `price_above_pool_max` / `placeholder_price` (가격 ineligible)
- `option_needs_review` / `*_low_confidence` (신뢰도 부족)
- `ai_audit_*` / `ai_escrow_*` (AI 의심 — 별 lane 처리)

## 영향

### 코드
- `src/lib/tick-pipeline.ts` 1 곳: `markRecoveredMarketInvalidatedPoolRowsDirty` 의 reason 필터 `eq.sku_median_unavailable` → `in.(22개 사유)`
- 검증 로직 (raw active+eligible + sku_median 회복) 그대로

### 사용자
- **fashion 한정 회복 매물 (24h+ stale active)**:
  - shoe profit_below_pack_band: 37
  - clothing profit_below_pack_band: 15
  - shoe negative_resell_gap: 9
  - shoe sku_median_unavailable: 8 (기존 cron 처리)
  - 기타 wave/lane 사유들: 4-6 each
  - 합계 약 **120-150 매물 회복 가능**
- 이후 시세/가격 변동 시 자동 회복 (cron 매 score tick 마다 돔)

### 흐름
1. 매 score tick: 함수가 fashion + 회복 가능 사유 매물 가져옴 (limit 250)
2. 각 매물의 raw 검증 (active + eligible + detail_done + sku_id + sku_median > 0 또는 comparable_key 시세 회복)
3. 통과 매물 `score_dirty=true` 마킹
4. score-worker 가 그 매물 처리 → candidate-pool-builder 재호출
5. 현재 시세/가격 기준 차익 1만+ 이면 ready 복귀, 아니면 사유 갱신

## 남은 영역 (별 wave)
- **다른 카테고리 (earphone/tablet/smartphone/smartwatch/laptop/watch/etc)** — 파서 강화 완료 후 fashion 한정 풀어주기
- 회복 불가 사유 중 일부는 운영 정책 재검토 가치 (sport_golf category_blocked 등)

## 메모리 룰
- 일반인 친화: ready 풀 복원 = 사용자에게 더 많은 매물
- 파레토 법칙: 한 사유 (profit_below_pack_band) 가 가장 큰 leverage — 사용자 짚음 정확
- 카테고리 제한은 안전 (파서 강화중) — 다른 세션 작업 영역 침범 X
- decision log: 이 파일
