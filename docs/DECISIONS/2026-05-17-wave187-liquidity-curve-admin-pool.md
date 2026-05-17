# Wave 187 — Liquidity 곡선 운영자풀 wire (3 화면 통일 마무리)

## 컨텍스트

Wave 183 에서 LiquidityCurveMini 박았지만 운영자풀에는 미박힘 — 별도 데이터 fetch (velocity + price 분포) 필요.

**3 화면 UI 통일 규칙** (메모리 노트):
> "매물 카드 UI 변경 시 3화면 다 적용 — 운영자풀 + 사용자 reveal + 나의 상품"

운영자풀이 빠져있어 일관성 깨짐 → 마무리.

## 박은 것

### 1. admin pool API — velocity + price 데이터 join

`/api/admin/pool-listings/route.ts` 에 두 batch 추가:

```ts
// comparable_keys 모아서 한 번에 fetch
const [velocityRes, priceRes] = await Promise.all([
  // velocity: condition='all' 만 박혀있음 (Wave 183 한계)
  restFetch(`...mvp_market_velocity_daily?...&condition_class=eq.all&order=date.desc&limit=2000`),
  // price: condition 무시 (latest 1 row per comparable_key, client-side pick)
  restFetch(`...mvp_market_price_daily?...&order=date.desc&limit=2000`),
]);
```

client-side 에서 `comparable_key 별 latest row` picking → `velocityMap` / `priceMap` 구축.

### 2. PoolItem 타입 확장 + items.map 응답

`PoolItem` 에 7개 필드 추가:
- `velocityP25Hours`, `velocityMedianHours`, `velocityP75Hours`, `velocitySoldSampleCount`
- `marketP25Price`, `marketMedianPrice`, `marketP75Price`

### 3. admin-pool-browser 카드에 LiquidityCurveMini wire

`RiskScoreBar` 옆에 `LiquidityCurveMini compact` 박음. 좁은 공간이라 compact 모드 (chip + 회전 라벨만).

```tsx
<div className="flex flex-wrap items-center gap-2">
  <RiskScoreBar ... />
  <LiquidityCurveMini ... compact />
</div>
```

## 데이터 한계 (Wave 183 동일)

- `mvp_market_velocity_daily.condition_class = 'all'` 만 박힘 → fine-grained 정확도 ↓
- 후속 wave (mining 측): velocity 도 condition_class 별 분리 필요

## Trade-off

### Pros
- **3 화면 UI 통일 완성** — admin/pack-reveal/user-reveal 모두 LiquidityCurveMini 표시
- 운영자가 매물 검토할 때 회전 추정 즉시 가시
- 추가 fetch 2개만 (전체 매물 한 번에 batch — N+1 차단)
- 동일 utility 재사용 (drift 0)

### Cons
- API 한 batch 더 늘림 — 응답 시간 약간 증가 (단 in.() 한 번 fetch + Promise.all)
- price.condition_class 무시 — 매물 condition 과 다른 row 가져올 수도 있음. 후속 wave fix

## Test

`npm run test:core`: **369/370 pass** (1 skipped, 0 fail).

## Follow-up (마스터 plan 측)

1. `mvp_market_velocity_daily` 의 condition 별 분리 (mining 작업)
2. price 도 매물 condition_class 매칭 row 사용 (정확도 ↑)
3. admin-pool API 응답 시간 모니터링 — 추가 batch 영향 확인

## Linked

- `2026-05-17-wave183-liquidity-curve-mini.md`
- `2026-05-17-l4-risk-score-chip.md`
