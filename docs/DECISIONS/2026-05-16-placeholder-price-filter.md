# 2026-05-16 — Placeholder price 매물 시세/풀 차단

## 트리거
Iteration 4 시세 정확도 sampling 중 발견. mvp_listings 11,618건 중 `price > sku_median * 1.3` 매물 1,775건 (15.3%). top 10 sample 분석 결과 거의 다 placeholder price.

## 진단
SQL 결과:
```
price_gte_100m: 14
price_lte_0: 0
normal: 11,604
```

샘플 (top 5):
| pid | price | sku_median | sku_name | description 시작 |
|---|---:|---:|---|---|
| 356723086 | 999,999,999 | 107,000 | Galaxy Watch 6 | "갤럭시 워치6 40mm 판매해요..." |
| 408005975 | 999,999,999 | 245,000 | G-Shock GMW-B5000 | "일본구매 제품..." |
| 393050623 | 999,999,999 | 475,000 | Apple Watch S10 | "판매완료 되었습니다." |
| 403441903 | 999,999,999 | 805,000 | MacBook Air | "맥북 에어 실버..." |
| 395424283 | 999,999,999 | 1,010,000 | Galaxy Tab S10 Ultra | "→ 아이패드 프로 M5 교환 원합니다" |

공통점: 셀러가 "교환만 원함" / "판매완료" / "분실" 같은 의도를 표시하려고 가격 placeholder 박음. **진짜 호가 아님.** 시세 sample에 포함되면 평균 끌어올림 (madTrim이 outlier 제거하지만 sample 적으면 미흡).

## Fix

### `src/lib/tick-pipeline.ts` — 2곳 patch

1. `upsertMarketPriceDaily` row 처리 시 placeholder skip:
   ```typescript
   if (row.price >= 100_000_000 || row.price <= 0) continue;
   ```
   영향: `mvp_market_price_daily.active_median/sold_median` 집계에서 자연 제외.

2. `scoreStage`의 `pricesByMarket` 채우는 loop에 동일 filter:
   ```typescript
   if (row.price >= 100_000_000 || row.price <= 0) continue;
   ```
   영향: `fallbackMedian` 계산에서 자연 제외.

3. `scoreStage`의 priceGap 계산 직전에 placeholder 표식:
   ```typescript
   const isPlaceholderPrice = row.price >= 100_000_000 || row.price <= 0;
   const priceGap = isPlaceholderPrice || skuMedian <= 0 ? 0 : ...;
   ```
   영향: score = 0 → 풀 진입 자동 차단.

## 검증
- TypeScript: validator.ts 외 무에러.
- ESLint: tick-pipeline 무에러.
- 1억 원 cap 안전성: 실제 매물 중 1억 넘는 진짜 호가 거의 없음 (laptop pro top spec 700만~1500만, 사치품 카메라도 1억 미만).

## 보류 / 다음
- mvp_listings의 placeholder 14건 SQL DELETE: 사용자 결정. priceGap=0 자연 차단이라 사용자 노출 0. lifecycle worker가 결국 missing 처리할 예정.
- lifecycle-worker가 "판매완료" / "교환원함" / "분실" 키워드를 잡아 ended 처리하는지 별도 wave에서 점검 가능.

## 위험
- 1억 cap 부적절하게 strict: 진짜 1억+ 사치품 매물 있으면 cut off. 데이터로는 14건 모두 placeholder pattern이라 안전.
- 향후 1억 cap에서 안 잡히는 placeholder pattern (예: 1,000원, 1원) 가능성. 다음 sweep에서 별도 처리.
