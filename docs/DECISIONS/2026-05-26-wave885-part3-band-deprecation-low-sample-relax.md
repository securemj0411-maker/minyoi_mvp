# Wave 885 Part 3 — band 시스템 폐기 완성 + low_sample 완화 (Wave 784 audit 후속)

## 배경

사용자 코멘트:
> "band 란 개념 없앤 지 오래됐지 않나??? 15만/30만/50만 이하 이런 식으로 우리 필터링 피드에서 할 수 있고 직접. band 는 진짜 옛날 개념인데?? 만약 이거 옛날 로직 때문에 ready 비율 낮은 거면 고쳐주고."

Wave 784 invalidated reason audit 결과:

| # | Reason | 매물 | 사용자 결정 |
|---|---|---|---|
| 1 | profit_below_pack_band | 1,261 | **고침** (옛날 로직, 폐기) |
| 4 | negative_resell_gap | 450 | 유지 (차익 음수 차단) |
| 7 | sku_low_volume_below_2d1_or_7d3 | 294 | 미결정 (설명만 — 2일 1개 미만/7일 3개 미만) |
| 14 | wave99_thin_market_n_lt_5 | 76 | **5 → 3 완화** |

## Fix 1: bandFromProfit threshold 10K → 1원 (band 시스템 폐기 완성)

### 원인
`src/lib/pool-policy.mjs` + `src/lib/profit.ts` 의 `bandFromProfit`:
- band 3 (70K+) / band 2 (40K+) / band 1 (10K+) / **null (10K 미만)**
- candidate-pool-builder.ts line 654: `if (band === null) → profit_below_pack_band invalidate`
- 즉 차익 1만원 미만 매물 모두 풀 차단.

당근 매물 = 번장의 56-67% 가격 → 차익 1천-9천원 매물 흔함 → 모두 차단.

### Wave 179 (2026-05-17) 이력
> "band 시스템 폐기됨. 1매물 = 1명에게만 노출."

`poolMaxExposure` 는 band 무관 5 일률로 폐기됨. 그러나 진입 gate threshold 는 **stale 10K 잔존**.

### Fix
```diff
- if (avg >= 10_000) return 1;
+ if (avg >= 1) return 1;  // Wave 885: 10_000 → 1 (band 폐기 결정).
```

`pool-policy.mjs` + `profit.ts` 동시 sync (Wave 755 패턴).

### 영향
- **profit_below_pack_band 1,261 매물** → 거의 다 풀 진입 가능
- `negative_resell_gap` (price >= skuMedian → 차익 0/음수) 별도 차단 유지 → 사용자 의도 "차익 안 나면 안 됨" 보존
- `profit_band` 컬럼 = admin/explore-monitor 시각화용만 (사용자 노출 X). 거의 다 "1" 박혀도 무해

### 검증
- regression test 추가 (`tests/wave885-broad-modelname-cleanup.test.ts`):
  - 차익 1원 → band 1
  - 차익 9천원 → band 1
  - 차익 4만원 → band 2 (유지)
  - 차익 7만원 → band 3 (유지)
  - 차익 0/음수 → null (negative_resell_gap 별도 차단)
- 12/12 tests pass

## Fix 2: wave99_thin_market_n_lt_5 — sample 5 → 3 완화

### 원인
`src/lib/tick-pipeline.ts` line 3080 `trustedMarketMedian`:
- LOW_SAMPLE_ALLOWED_CATEGORIES (shoe/clothing/bag/drone/lego/kickboard/perfume/game_console/sport_golf): total < 2 차단
- 그 외 (smartphone/tablet/laptop/earphone/smartwatch/watch/...): total < 3 차단 + **low confidence + total < 5 차단**

후자 (electronics) 만 5 sample 강제. 76 매물 차단.

### Fix
```diff
- if (stat.confidence === "low" && total < 5) return null;
+ if (stat.confidence === "low" && total < 3) return null;
```

### Trade-off
- outlier 1건이 median 끌어올릴 위험 늘어남 (low confidence + 3 sample 이라)
- safety nets 작동 중: Wave 171 ceiling (msrp×5), Wave 152 4-tier fake floor, Wave 72 광고 차단, Wave 138 셀러당 1 entry
- 사용자 합의 후 박음 ("3 sample ㄱㄱ").

## 사용자 거부

`negative_resell_gap` (차익 음수) 완화 — **거부**.
> "ㄴㄴ 차익 안 나면 하면 안 되지"

차익 양수일 때만 풀 진입 — 사용자 의도 명확.

## 미결정

`sku_low_volume_below_2d1_or_7d3` (294 매물) — 사용자 "2일 1개 무슨 말인지 모르겠음" → 설명만:
- "최근 2일 내 1개 미만 거래 OR 최근 7일 내 3개 미만 거래" = SKU 거래량 부족 → 시세 신뢰 X → 차단
- 후속 wave 에서 사용자 결정 받기.

## 당근 한정 추가 audit (option A 박음)

당근 풀 진입 못한 clothing/shoe 3,418 매물 indicator:

| Indicator | 결과 |
|---|---|
| has_thumbnail | 3,414 (99.9%) |
| parser needs_review=false | 3,418 (100%) |
| parse_confidence ≥ 0.7 | 3,249 (95%) |
| parse_confidence 0.5-0.7 | 169 (5%) |

당근 invalidated 13 reason:
- profit_below_pack_band: **9** ← Fix 1 으로 풀림
- sku_low_volume_below_2d1_or_7d3: 6
- ai_audit_reject_review: 1

**결론**: 당근 매물의 풀 진입 막은 진짜 원인 = `bandFromProfit` stale 10K threshold (정확히 사용자 짚은 옛 로직). Fix 1 이 정답.

## What Not To Do

- bandFromProfit 호출 자체 제거 X — `profit_band` 컬럼이 admin 시각화에 쓰임 (시각화 깨지면 안 됨). threshold 만 1원으로 낮춤.
- negative_resell_gap 완화 X — 사용자 결정 "차익 안 나면 안 됨".
- low_sample (LOW_SAMPLE_ALLOWED_CATEGORIES) 의 total<2 차단 완화 X — 사용자 결정 아직 안 받음.

## 후속 wave

- Wave 885 Part 4 (선택): `sku_low_volume_below_2d1_or_7d3` 완화 검토 — 사용자 결정 받기.
- Wave 885 Part 5 (선택): score-worker `skipReasonCounts` DB 노출 (코드 patch) — entry 생성 안 된 매물 reject reason 추적용.
- Wave 885 verification (24-48h 후): pool ready 매물 추이 측정. 의류/신발 99% → ?% 변화 확인.
