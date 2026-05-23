# launch-83 — 시세 그래프 데이터 부족 시 섹션 자체 hide

## 사용자 결정

> "신발 시세가 없으면 그래프 뭐 준비중?? 데이터 확보중?? 이런거 말고 그냥 없애버리면 어때 시세 그래프 안나오면은?? ... 괜히 데이터 수집중이런거 보이면 완벽하지 않은 사이트 처럼 보일듯??"

launch-82 audit 결과: 신발 89.4% / 의류 77% 매물이 그래프 빈 상태("시세 누적 중") 메시지 표시. UX 완성도 ↓ 위험.

## Before

```
시세 그래프 · 시장 분석                    최신 수집 기준
┌─────────────────────────────────────────────────┐
│  시세 누적 중 — 아직 history 없어요 (매물 처음 등록)│
│                                                 │
│  그래프 기준 보기 ▾                              │
│  같은 상태 · 통합 같은 상태 매물 추이             │
└─────────────────────────────────────────────────┘
```

신발/의류 80~90% 매물에서 사용자가 이 placeholder 메시지를 본 상태 — "데이터 부족 사이트" 인상.

## After

데이터 충분 (2일+) → 그래프 표시 (기존 동작).
데이터 부족 / 모델 미분류 / 에러 → **섹션 전체 (시세 그래프 헤더 + chart + trust line + mini flow) 다 hide**.

빈 상태에서 사용자 화면엔 시세 비교 매물 패널 바로 보임 — 깔끔.

## 구현

### 1. `market-history-chart.tsx`
- `ChartState` named type 신규 export: `"loading" | "available" | "empty" | "reference_only" | "error" | "no_key"`.
- 새 props 2개:
  - `nullOnEmpty?: boolean` — true 면 빈 상태/에러/모델 미분류/표본 부족 분기에서 `return null`.
  - `onState?: (s: ChartState) => void` — fetch 시작/결과를 parent 에 알림.
- 기존 4 빈 상태 분기 모두 `nullOnEmpty` 가드 추가 + `useEffect` 안에서 onState callback 호출.
- **reference 매물 안내** ("다나와 새상품 기준 X원 · 번개 미개봉 추이는 표본 누적 중") 는 보존 — `nullOnEmpty` 무시하고 안내 박스 표시 (의도된 카피).
- admin-pool-browser 같은 운영자 도구는 `nullOnEmpty` 안 넘김 → 기존 텍스트 안내 그대로.

### 2. `pack-reveal-modal.tsx` — 새 컴포넌트 `DetailMarketGraphSection`
이전 launch-77 의 inline wrapper (시세 그래프 · 시장 분석 헤더 + MarketHistoryChart + MarketGraphTrustLine + SkuListingFlowMini) 를 별도 컴포넌트로 분리.
- 내부 `chartState` state (default "loading")
- `showWrapper = chartState === "loading" | "available" | "reference_only"`
- 그 외 (empty / error / no_key) → `return null`
- MarketHistoryChart 에 `nullOnEmpty` + `onState={setChartState}` 전달

### 3. `pack-reveal-modal.tsx` — `BeginnerGuideTrendVisual` (쉬운모드 trend step)
같은 패턴. wrapper 자체 null 반환 — trend step 안에 그래프가 사라지면 그 step 의 visual 부분만 비어 보임. step 의 헤더/메트릭 라벨은 그대로 보존.

## 영향 / trade-off

### ✅ 좋은 점
- 신발/의류 80~90% 매물에서 placeholder 박스 안 보임 → 완성도 인상 ↑
- "데이터 수집 중" 문구 없으니 사이트 미완성 인상 차단
- 시세 비교 매물 패널은 그대로 표시 (별도 분리된 정보)

### ⚠️ trade-off
- 첫 mount 시 잠깐 chart skeleton 보였다가 빈 상태면 wrapper 사라짐 — 깜빡임 가능 (acceptable)
- reference 매물 (다나와 미개봉 매물) 은 안내 박스 그대로 (의도)
- 쉬운모드 trend step 의 visual 자리만 비어 보임 — step 자체는 skip 안 함 (carousel index 영향 차단)

### 안 바뀐 동작
- 데이터 충분 (2일+) 시 그래프 그대로
- admin-pool-browser 운영자 도구 — `nullOnEmpty` 안 쓰니까 기존 텍스트 안내 그대로
- rate limit, fallback chain 그대로

## 검증

- [x] TS 컴파일 통과 — `market-history-chart.tsx` / `pack-reveal-modal.tsx` 에러 0
- [x] `ChartState` named export + named import (`MarketChartState` alias)
- [x] launch-77 의 wrapper inline 코드 → `DetailMarketGraphSection` 컴포넌트로 깔끔 분리
- [ ] production 매물별 노출 비율 측정 (다음 deploy 후)

## 관련 파일

- [src/components/market-history-chart.tsx](../../src/components/market-history-chart.tsx) — props `nullOnEmpty` + `onState` 추가
- [src/components/pack-reveal-modal.tsx](../../src/components/pack-reveal-modal.tsx) — `DetailMarketGraphSection` 신설 + `BeginnerGuideTrendVisual` 보강
- launch-77 — 시세 그래프 상세페이지 복원 (이 wave 의 직접 trigger 매물 = launch-82 audit)
- launch-82 — 시세 그래프 작동 검토 (이 wave 의 결정 근거 데이터)

Owner: caulee1227@gmail.com / 2026-05-23
