# 2026-05-19 Wave 369 — pool API expected_profit 재계산 (root fix)

사용자 캡쳐 4건 모순:
- 시세 < 매입인데 차익 +양수 표시 → 사기처럼 보임
- 사용자 신뢰 손상

## 원인 (Wave 247.2 + 249 decision log 분석)

**별 세션 작업 흐름**:
1. Wave 246: 시세 0원 미스리딩 fix (UI)
2. Wave 247.2: pool API `bandAwareMedian` 적용 — `mvp_listings.sku_median` raw 대신 `mvp_market_price_daily` band-aware median 사용. **fetch만 변경, additive only**.
3. Wave 249: pool builder gate (sku_median_unavailable + negative_resell_gap) 추가 — pool 진입 시점 차단.

**남은 불일치**:
- `expected_profit_min/max` (DB column) = pool builder가 **계산 시점**의 `row.skuMedian` 기준
- 표시 시세 = pool API 응답 시점의 `bandAwareMedian` (cron job 등으로 갱신된 값)
- 두 시점 사이 `mvp_market_price_daily` 데이터 갱신되면 → DB column expected_profit과 표시 시세 모순

Wave 249 decision log line 105: "broad `mvp_listings.sku_median` 만 보면 음수처럼 보이지만 pool builder 시점의 band-aware skuMedian 기준 정상". 즉 pool builder는 정상 동작하지만 **응답 시점에 시세가 더 갱신되면** drift.

## 결정 — root fix: 응답 시점 재계산

`buildItems`에서 표시 시세 (`skuMedianFinal`) 기준으로 `expected_profit_min/max` **다시 계산**:

```ts
const sellFee = Math.round(skuMedianFinal * SELLING_FEE_RATE);  // 3.5%
recomputedProfitMax = Math.max(0, skuMedianFinal - price - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
recomputedProfitMin = Math.max(0, skuMedianFinal - (price + ASSUMED_BUY_SHIPPING) - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
```

- `candidate-pool-builder.ts:398-402` 와 **동일 공식**
- 상수: `SELLING_FEE_RATE=0.035`, `RESELL_SHIPPING_FEE=3500`, `SAFETY_BUFFER=5000`
- 단순화: `buyer_shipping`, `estimated_buy_cost`는 mvp_listings 추가 join 없이 추정 (3500 평균)
- 표시 시세 → 표시 차익 항상 sync (수학적 보장)

## 안전망 (Wave 368 강화)

```ts
if (recomputedProfitMax <= 0) return null;  // 응답에서 제외
```

재계산 후 차익 0이면 → 풀에서 silently 제외 (UI 비노출).
이전 wave 368의 `raw.price > skuMedianFinal` 가드보다 더 정밀.

## 변경 파일

`src/app/api/packs/pool/route.ts`:
- profit.ts 상수 import 추가
- `buildItems` map callback 내 `recomputedProfitMin/Max` 계산
- `expectedProfitMin/Max` response field를 재계산 값으로 교체
- 안전망 조건 wave 368 → wave 369 (재계산 기준)

## Trade-off

**정밀도**:
- buyer_shipping 정확값 모름 (mvp_listings에 컬럼 join 안 함) → 3500 가정
- `estimated_buy_cost` 모름 (스냅샷 테이블 join 안 함) → price 사용
- → DB column expected_profit과 약간 다를 수 있음. but **표시 시세와 일관** 우선.

**더 정확하려면** (별 wave):
- mvp_listings에서 `shipping_fee_general`, `shipping_fee` 추가 fetch
- 또는 `mvp_candidates_shipping` 스냅샷 join

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 효과

캡쳐 4건 예측:
- **RRL 벨트** (매입 350k, 시세 183k): `183 - 350 - ...` < 0 → max(0, ...) = 0 → 응답에서 제외 ✓
- **아이패드 10세대** (매입 610k, 시세 561k): `561 - 610 - ...` < 0 → 제외 ✓
- **애플워치9 GPS** (매입 380k, 시세 386k): `386 - 380 - 13.5(셀러 수수료) - 3.5 - 5` ≈ -16k → 제외 ✓
- **애플워치 울트라** (매입 230k, 시세 402k): `402 - 230 - 14 - 3.5 - 5` ≈ 149k → 차익 표시. 기존 +143k와 유사 ✓

→ 사용자에게 보이는 매물은 모두 **차익 양수 + 표시 시세 ↔ 차익 sync**.
