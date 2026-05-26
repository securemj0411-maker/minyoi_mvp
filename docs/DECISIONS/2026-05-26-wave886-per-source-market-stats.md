# Wave 886 — 당근 전용 시세 (per-source market stats)

## 사용자 결정

> "당근 매물 시세 = 당근 sample 만 사용. fee 보정만으론 부족 (실제 가격 차 35-44%)."

### 배경 / 데이터

동일 SKU/condition 매물의 가격이 source 별 큰 차이:

| SKU | 번장 median | 당근 median | 비율 |
|---|---|---|---|
| Polo 폴로티 | 39K | 25K | **64%** |
| 유니클로 | 25K | 15K | **60%** |
| 폴로 아파렐 | 72K | 40K | **56%** |
| Tommy Hilfiger | 30K | 20K | **67%** |

fee 차이 (안전결제 3.5% + 택배비 3K) 만으론 5-10% 수준 — 실제 35-44% 차이 설명 불가.

격차 원인:
- 당근 동네 직거래 = 빨리 팔려고 헐값
- 사기 risk 낮아 셀러 가격 책정 다름
- 당근 사용자 demographic 다름 (가격 민감)

기존 mixed median 사용 시:
- 당근 매물 차익 부풀려 보임 ("시세 11만인데 5만" 인줄 알았는데 당근 시세는 8만)
- 신뢰 깎임 — 사용자가 당근 매물 사서 당근에 팔 때 실제 받을 가격 < 우리 표시 시세

## 비즈니스 context

> "초반 고객 = 일반인. 중나/번장 사기 무서워함. 당근 안심 (직거래) → gateway 역할. 당근 위주 추천."

→ 당근 매물 시세 정확도 = 최우선

## 구현 (3 Phase)

### Phase 1: Migration (applied)

신규 테이블 `mvp_market_price_daily_per_source`:
```sql
CREATE TABLE mvp_market_price_daily_per_source (
  date DATE NOT NULL,
  comparable_key TEXT NOT NULL,
  condition_class TEXT NOT NULL DEFAULT '',
  condition_tier TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,  -- 'bunjang' | 'daangn' | 'joongna'
  category TEXT, family TEXT, model TEXT, variant_key TEXT,
  active_median_price INTEGER, sold_median_price INTEGER, blended_median_price INTEGER,
  p25_price INTEGER, p75_price INTEGER,
  active_sample_count INTEGER, sold_sample_count INTEGER, disappeared_sample_count INTEGER,
  confidence TEXT,
  computed_at TIMESTAMPTZ,
  PRIMARY KEY (date, comparable_key, condition_class, condition_tier, source)
);
```

비파괴 — 기존 `mvp_market_price_daily` (mixed) 그대로.

### Phase 2: Market-stats write (PR #29)

`src/lib/tick-pipeline.ts` 의 `recomputeMarketStats()` 변경:
- 기존 `marketRows` (mixed median) 그대로 박음 → `mvp_market_price_daily` UPSERT
- 추가: `perSourceMarketRows` build → `mvp_market_price_daily_per_source` UPSERT
- 각 byKey group 안 activeRows/soldRows/disappearedRows 를 source 별로 split
- 각 source 별 stats 계산 (기존 logic: decayTrimmedSellerMarket + blendedMedian + confidence)
- per-source upsert 실패 → try/catch swallow (mixed write 영향 0)

### Phase 3: Score stage read (PR #30)

`src/lib/tick-pipeline.ts` 의 score stage:
- 신규 `loadMarketPriceStatsPerSource()` 함수 — `mvp_market_price_daily_per_source` fetch
- 신규 `pickPerSourceStatForMatter()` helper — 매물 source 일치 sample ≥ 3 면 per-source stat 반환, 부족 시 null
- score stage 의 `exactMarketStat` 결정:
  ```typescript
  const perSourceMarketStat = pickPerSourceStatForMatter(...);
  const exactMarketStat = perSourceMarketStat ?? exactMixedMarketStat;
  ```
- per-source map fetch 실패 → null → mixed fallback (기존 동작)

## 비파괴 보장

- 기존 `mvp_market_price_daily` (mixed) / candidate-pool-builder / score 로직 변경 X
- per-source fetch 실패 → mixed 사용 (try/catch)
- per-source sample < 3 → mixed fallback
- 매물 source 없음 → mixed
- per-source upsert 실패 → cron 자체 영향 X

## 기대 효과

- 당근 매물 차익 정확도 ↑ — 당근 시세 = 번장의 56-67% 이라 mixed median 사용 시 부풀려졌음
- 번장 매물도 살짝 정확도 ↑ — 당근 매물이 mixed median 끌어내렸던 거 정정
- 사용자 의도 "초반 당근 위주 추천 + gateway 역할" 정확도 보장

## 24h 후 측정 SQL

```sql
-- per-source vs mixed 시세 차이
SELECT
  s.source,
  COUNT(*) AS keys,
  ROUND(AVG(s.blended_median_price)) AS source_median,
  ROUND(AVG(d.blended_median_price)) AS mixed_median,
  ROUND(AVG(s.blended_median_price - d.blended_median_price)) AS diff
FROM mvp_market_price_daily_per_source s
JOIN mvp_market_price_daily d
  ON d.date = s.date
  AND d.comparable_key = s.comparable_key
  AND d.condition_class = s.condition_class
WHERE s.date = CURRENT_DATE
  AND s.active_sample_count + s.sold_sample_count >= 3
GROUP BY s.source;
```

## What Not To Do

- per-source 사용 시 sample threshold 낮추지 X (현재 3, Wave 885 thin_market 와 동일).
- per-source fetch 실패 시 hard error 박지 X — mixed fallback 으로 graceful degradation.
- candidate-pool-builder skuMedian 결정 핵심 로직 변경 X — score stage 만 변경.
- 사이즈 fallback (shoeSizeAgnosticComparableKey) 의 per-source 처리 별도 wave — 지금 박지 X.

## 후속

- 24-48h 후 per-source 데이터 누적 측정.
- market-worker 빈도 (현재 매시간) ↑ 검토 — 사용자 결정 필요 (lambda 비용 trade-off).
- 사이즈 fallback 의 per-source 처리 — Wave 887 후보.
- UI 라벨 "당근 시세 기준" / "전체 시세 기준" (fallback 시) — 사용자 결정 필요.

## PR

- Migration (Phase 1) — Supabase MCP `mcp__supabase__apply_migration` applied
- Phase 2 — PR #29 (merged 21:17 UTC)
- Phase 3 — PR #30 (merged 21:30 UTC)
