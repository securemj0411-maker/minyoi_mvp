# Wave 297 — 판매속도 표본 부족 UI fallback

## 배경
- `/me` 상품 상세의 "비슷한 상품은 보통 N시간/일 안에 팔렸어요" 블록은 실제 `velocityBasis` 와 최근 sold 표본이 있을 때만 표시됐다.
- 판매속도 데이터가 아직 없는 SKU는 상세 UI 검수 중 해당 영역이 사라져 레이아웃과 문구를 확인하기 어려웠다.

## 결정
- 상세 화면에서 판매속도 표본이 없거나 `medianHoursToSold` 가 없으면 UI 테스트용으로 48시간(2일) fallback을 표시한다.
- 실제 판매속도 표본이 있으면 기존 실데이터가 우선한다.
- 사용자가 실데이터로 오해하지 않도록 fallback 상태에는 "UI 테스트" / "표본 부족, 임시 2일 기준" 문구를 같이 노출한다.
- 가격대별 판매속도 mini chart도 동일 fallback을 받을 수 있도록 `uiTestFallback` prop을 추가했다.

## 구현
- `src/components/pack-reveal-modal.tsx`
  - `VelocityBasisMini`가 `velocityBasis` null/표본 부족 상태에서도 2일 기준 블록을 렌더링하도록 변경.
  - `LiquidityCurveMini` 호출 시 `medianHours` fallback 48시간과 `uiTestFallback` 상태를 전달.
  - 같은 파일의 내부 홈 이동 링크를 Next `Link`로 교체해 lint 규칙을 만족시킴.
- `src/components/liquidity-curve-mini.tsx`
  - `uiTestFallback`일 때 sold 표본 0건이어도 추정 UI를 보여주고, 하단에는 임시 기준임을 표시.
- `src/lib/liquidity-curve.ts`
  - 2.0일처럼 보이는 정수 일수 표기를 2일로 정리.

## 보류
- 이 fallback은 DB/크론/market velocity 산출 로직을 바꾸지 않는다.
- 실제 서비스 출시 전에는 feature flag 또는 dev/test 전용 조건으로 바꾸는 것이 맞다.
- 표본 부족 상태에서 임시 판매속도를 추천 근거 점수에 반영하는 것은 보류했다. 현재는 상세 UI 표시용이다.

## 검증
- `npx eslint src/components/pack-reveal-modal.tsx src/components/liquidity-curve-mini.tsx src/lib/liquidity-curve.ts`
- `npm run build`
