# 2026-05-17 시세 근거 좌측 / 그래프 우측 + 운영자풀 그래프 자동 로드

## 사용자 지적

> "📊 시세 근거 ... 이건 왼쪽에 하고 오른쪽에는 시세그래프좀 놓으라고
> /me 운영자풀에 시세그래프 안 보임??"

## 박은 변경 (commit `f8ec93c`)

### pack-reveal-modal RevealCardItem
- **좌측 카드**: 매물 정보 + **MarketBasisMini (시세 근거)**
  - image + 이름 + 가격 + verdicts + confusionNote + MarketBasisMini
- **우측 카드**: 시세 그래프 + 시장 분석
  - 헤더 "📊 시세 그래프 · 시장 분석"
  - MarketHistoryChart + VelocityBasisMini + SkuListingFlowMini + MarketSourceDebug

### admin-pool-browser
- MarketHistoryChart `lazy` prop 제거
- 이전: 클릭 필요 (lazy 모드) → 사용자 "안 보임"
- 새: 자동 로드 — 카드 펼치면 즉시 그래프

## Trade-off

- admin-pool 자동 로드 = rate limit 압박 가능 (pool 카드 수만큼 호출)
- 사용자 의도 명시 — 즉시 보임 우선
- rate limit 별도 wave 검토

## Test

288/288 pass.
