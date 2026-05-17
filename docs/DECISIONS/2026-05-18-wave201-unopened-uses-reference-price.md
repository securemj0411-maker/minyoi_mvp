# Wave 201 — unopened 매물 시세 = 다나와 anchor (reference_prices)

## 사용자

> "아니 새상품이면 다나와 시세를 보여줘야지 뭘 고민하는건데 대체??"

→ 즉시 fix.

## 문제 (Wave 200에서 보고)

| 항목 | 박혀있던 데이터 |
|---|---|
| `mvp_reference_prices` (Apple Watch SE3 40mm GPS) | **369,000원** (다나와/공식 anchor) |
| `mvp_market_price_daily` unopened condition | 300,000원 (번개 sold/active median) |
| 매물 카드 표시 | **300,000원** ← sold median 사용 |
| 라벨 | "📍 다나와 새 가격" ← mismatch |

미개봉 매물인데 번개 중고 거래가 표시 — 사용자 의도와 불일치.

## fix

### 1. `fetchReferencePrices()` 신설 (`pack-open.ts`)

```ts
export async function fetchReferencePrices(comparableKeys: (string | null)[]): Promise<Map<string, number>>
```

`mvp_reference_prices?select=comparable_key,effective_price&effective_price=not.is.null` fetch → Map.

### 2. `marketBasisForCandidate` 시그니처에 `referencePrices` 추가

```ts
const refPrice = (actualCondition === "unopened" && comparableKey && referencePrices?.get(comparableKey)) || null;
const useRefAnchor = refPrice != null && refPrice > 0;
const medianPriceFinal = useRefAnchor ? refPrice : (stat?.blended_median_price ?? stat?.active_median_price ?? null);
```

- unopened AND reference 박혀있으면 → `medianPrice = effective_price`
- 그 외 → 기존 sold/active median
- p25/p75 는 null (단일 anchor 값이라 분포 없음)
- confidence = "medium" (단일 값이라 "high" 비호환)

### 3. `openPack` Promise.all 에 추가

```ts
const [..., referencePrices] = await Promise.all([
  ..., fetchReferencePrices(reserved.map((r) => r.comparable_key)),
]);
```

→ pack-reveal + user-reveal-dashboard 자동 반영 (같은 marketBasis 사용).

### 4. admin pool API (`/api/admin/pool-listings`) 동일

`mvp_reference_prices` fetch 추가 + items.map 에서:
```ts
...(p.condition_class === "unopened" && refPriceMap.has(comparableKey)
  ? { marketP25Price: null, marketMedianPrice: refPrice, marketP75Price: null }
  : { marketP25Price: ..., marketMedianPrice: ..., marketP75Price: ... })
```

Wave 187 박은 marketP25/median/p75Price (Liquidity 곡선 입력) 도 unopened 시 ref anchor.

### 5. 안전 가드
`fetchReferencePrices` 의 fetch 응답이 array 아니면 `[]` fallback — test mock fall-through 대응.

## 효과

이전:
```
애플워치 SE3 40mm 미개봉
매입 290,000원 · 시세 300,000원 (번개 sold)  ← mismatch
차익 +57,585원
```

지금:
```
애플워치 SE3 40mm 미개봉
매입 290,000원 · 시세 369,000원 (다나와 anchor) ← 일치
차익 +N원 (재계산 필요 — candidate_pool 박힌 expected_profit 그대로)
```

**주의**: `candidate_pool.expected_profit_min/max` 는 풀 진입 시점 박힌 값. 시세 표시는 fix 박혔지만 차익 표시는 candidate_pool 박힌 값 그대로 → fix 후 처음 풀 진입하는 매물부터 정확. 기존 풀 매물은 다음 재계산까지 stale.

## 비파괴 검토

- `mvp_market_price_daily` 박힌 row 변경 X (mining 측은 그대로)
- 시세 산출 로직 (read 측) 만 변경
- `marketBasisForCandidate` 시그니처 backward compat — `referencePrices?` optional
- 새 fetch 1개 (Promise.all 안 — 응답 시간 영향 거의 없음)

## Test

`npm run test:core`: **437/438 pass**.
실패 1개 (`wave159h-condition-fallback`) 는 다른 worktree 의 condition fallback 로직 변경 — 본 wave 무관 (내 변경은 referencePrices 추가만, fallback 로직 미수정).

## Follow-up

1. **다른 condition 도 anchor 사용 검토** — clean/mint 도 reference 가격 가중 평균 가능
2. **candidate_pool expected_profit 재계산** — 기존 unopened 매물 차익 stale → 재산출 wave
3. **라벨 정확화** — "📍 다나와 새 가격" 라벨이 실제 unopened 시 ref 데이터 가리키게 (이미 박혀있는데 검증)
4. **사용자 검증** — Apple Watch SE3 외 iPhone / AirPods / iPad 등 reference 박힌 SKU 동일 fix

## Linked

- `2026-05-18-wave200-terminal-listings-hide-toggle.md` (시세 검증 보고)
- Wave 130 (condition 별 시세 분리)
