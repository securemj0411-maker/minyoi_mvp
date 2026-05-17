# 2026-05-17 pack-reveal-modal PC 2 column layout

## 사용자 지적

> "지금 왼쪽에만 치우쳐졌는데. 오른쪽에는 시세근거 눌렀을 때 나오는 그거 나오게 하고
> 시세그래프랑 상세 내용 나오게 해주셈. 진짜 멋진 사이트 시각적 CTA 와 우리를 이렇게
> 안전하고 정확한 시세를 잡아주는구나 느껴지게"

빈 우측 공간 시각 강조 — "정확한 시세 분석" 신뢰 build.

## 박은 변경 (commit `5cca758`)

ListingPreviewPanel layout:

### 이전
```
[image 150px] [info (다 1 column)]
              - 이름 / 차익 / 등급 chip / 신뢰%
              - 매입 / 시세
              - verdicts
              - 시세 근거 (MarketBasisMini)
              - 시세 그래프 (MarketHistoryChart)
              - velocity
              - flow
              - 시세 근거 디버그 (MarketSourceDebug)
              - 노트
              - 버튼
```

### 새 (PC, lg+)
```
[image 150px] [좌측 메타]                  [우측 시세 영역]
              - 이름                       - MarketBasisMini
              - 차익 / 등급 chip / 신뢰%   - MarketHistoryChart (그래프)
              - 매입 / 시세                - VelocityBasisMini
              - verdicts                   - SkuListingFlowMini
              - confusionNote              - MarketSourceDebug (시세 근거 디버그)

[노트 + 버튼 = full width]
```

모바일 (lg 미만): 자연 stack (기존 흐름).

## 효과

- 빈 우측 공간 활용 — 이전 왼쪽만 채워짐
- 첫 화면에 그래프 + 시세 근거 즉시 보임 (스크롤 X)
- 시각 CTA = "AI가 시세 정확히 분석" 신뢰 build
- 시세 데이터 prominence ↑

## Test

288/288 pass.
