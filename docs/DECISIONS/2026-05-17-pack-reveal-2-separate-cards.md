# 2026-05-17 pack-reveal-modal — 매물 카드 2개로 분리 (listing + market)

## 사용자 명시

> "이 카드 안에서만 왼쪽 오른쪽이 아니라 옆에 다른 카드를 만들고
> 시세랑 다른 세부정보들 신뢰감 주는 정보들 옮겨넣으라고"

이전 시도 (commit `f01185c`) = 한 카드 안에서 inner grid 분리 — 사용자 의도와 다름. 카드 자체를 2개로 분리해야.

## 박은 변경 (commit `1f90303`)

### RevealCardItem layout
- outer: `grid lg:grid-cols-2` (모바일 stack)
- **좌측 카드** (별도 border + shadow) = 매물 정보:
  - image + 메타 + 가격 + verdicts + confusionNote
- **우측 카드** (별도 border + shadow) = "📊 시세 분석":
  - MarketBasisMini + MarketHistoryChart + VelocityBasisMini + SkuListingFlowMini + MarketSourceDebug
- 노트 + 버튼 = `lg:col-span-2` (전체 width)

### success result outer grid
- `md:grid-cols-2` → 단일 column (`grid gap-4`)
- 한 줄에 1 매물 (= 좌측 카드 + 우측 카드 옆에)
- 매물 여러 개면 row stack

### ListingPreviewPanel (별도 floating panel)
- 기존 layout 그대로 (이전 commit revert)
- 460px width 한쪽 floating

## 효과

- 사용자 의도 일치 — 카드 안 split 이 아니라 **별도 카드 2개 옆에**
- 좌측: 매물 정보 = 깔끔한 카드 + 시각 강조
- 우측: 시세 분석 = 별도 카드 + 그래프/근거 보이는 cta
- 모바일: stack — 매물 카드 위, 시세 카드 아래

## Test

288/288 pass.
