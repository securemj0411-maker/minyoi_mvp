# Wave 183 — Liquidity 곡선 mini-chart (가격대별 회전 추정)

## 컨텍스트

Master plan Phase 1 L6 — 사업 보고서 retention 1순위.
> "회전 기간이 떡상점수보다 더 retention-critical한 지표일 수 있습니다. 사용자가 가장 두려워하는 게 안 팔리는 거니까."

기존 `VelocityBasisMini` 는 단일 회전 시간 (median hours) 만 표시. 본 wave 는 **가격 위치별 회전 시간 + 5% 인하/인상 시 추정** 추가.

## 박은 것

### 1. Utility — `src/lib/liquidity-curve.ts`

```ts
export type LiquidityCurveInput = {
  price, p25Price, medianPrice, p75Price,
  p25Hours, medianHours, p75Hours, soldSampleCount
};

export function buildLiquidityCurve(input): LiquidityCurve {
  position: "fast" | "average" | "slow" | "unknown",
  estimatedHours,                    // 매물 price → 추정 회전
  estimatedHoursAt5PctDiscount,      // 5% 인하 시 추정
  estimatedHoursAt5PctMarkup,        // 5% 인상 시 추정
  priceRatio,                        // 0=p25 / 0.5=median / 1=p75
  bucketIndex,                       // 0~4 (mini-bar 위치)
  confident                          // sample>=5 && p25/p75 둘 다 있음
}
```

**보간 로직**: piecewise linear (`p25 → median → p75`). price ≤ p25 → p25 회전, ≥ p75 → p75 회전, 중간 구간은 선형.

### 2. Component — `src/components/liquidity-curve-mini.tsx`

- 5칸 mini-bar (저렴/빠름 → 비쌈/느림) + 매물 위치 ring 강조
- 추정 회전 시간 hero: "이 가격 → 약 N시간 안에 팔림 (추정)"
- 5% 인하/인상 보조 카드 2개 (emerald/rose)
- sample count + "추정 — 실제와 다를 수 있어요" 명시
- `compact={true}` 옵션 — 좁은 영역용 chip

### 3. Wire — pack-reveal-modal (우측 카드 시세 분석)

`<VelocityBasisMini>` 옆에 박음. RevealCard 에 이미 marketBasis/velocityBasis 박혀있어 추가 fetch 0.

### 4. 자동 wire — user-reveal-dashboard

"상품 보기" 모달이 `PackRevealModal` 재사용 → 자동 반영됨.

## 데이터 한계

`mvp_market_velocity_daily.condition_class = 'all'` 만 박힘 (`mvp_market_price_daily` 는 condition 별).
- velocity 가 condition 통합이라 condition 별 정확도 ↓
- 후속 wave: velocity 도 condition 별 분리 (mining 측 작업)
- 일단 가용 데이터 기반 추정 + sample count 명시 + "추정" 강조

회전 시간이 비현실적으로 짧은 매물도 있음 (median 2~3시간) — listing → sold 사이클 빠른 매물만 잡혀있어서. UI에서 "시간/일" 자동 환산 + sample count 신뢰도 표시.

## Trade-off

### Pros
- master plan retention 1순위 항목 박음
- 추가 fetch 없음 (기존 reveal data 활용)
- 5% 인하/인상 시뮬레이션 → 매도 의사결정 직접 도움
- "이 가격에 어느 정도 묶일지" 두려움 명시적 해소

### Cons
- velocity condition='all' 한계 — fine-grained 정확도 떨어짐
- 선형 보간이라 실제 곡선과 다를 수 있음 (단 추정 + 명시)
- admin-pool-browser 는 별도 데이터 fetch 필요 → **후속 wave** (이번 wave에서 미포함)

## Test

`npm run test:core`: **328/328 pass**.

## Follow-up

1. **admin-pool-browser wire** — velocity P25/P75/sample 데이터 admin API 에 추가 + LiquidityCurveMini 박기
2. **velocity condition 별 분리** — mining 측 작업 (velocity-daily aggregation 에 condition_class group_by)
3. **A/B test**: LiquidityCurveMini 표시 vs 미표시 → 매수 conversion / 회전 만족도 비교
4. **AI 결합**: 회전 추정 + risk score → "5% 인하 권고" 자동 메시지

## Linked

- `2026-05-17-master-plan-deferred-items.md`
- `2026-05-17-l4-risk-score-chip.md`
- `2026-05-17-wave182-saved-money-counter-loss-report.md`
