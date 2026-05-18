# Wave 299 — 판매속도 강조 카드 복구

## 배경
- Wave 298에서 판매속도를 시세 바로 아래로 옮기면서 compact row 형태로 줄였고, 시장 분석 영역에는 가격대별 판매속도 곡선을 남겼다.
- 사용자는 "이 가격이면 얼마나 빨리 팔릴까"는 당연한 설명이라 학습 비용만 만들고, 정작 "비슷한 상품은 보통 N일 안에 팔렸어요"가 눈에 잘 안 들어온다고 지적했다.

## 결정
- `/me` 상품 상세의 상단 가격 정보 바로 아래에 기존처럼 큰 판매속도 강조 카드를 복구한다.
- `왜 이걸 추천했나요?` 패널은 판매속도 카드 바로 아래에 유지한다.
- 상세 화면에서는 가격대별 판매속도 곡선(`이 가격이면 얼마나 빨리 팔릴까`)을 제거한다.
- 판매속도 데이터가 없을 때의 2일 UI 테스트 fallback은 유지하되, 명확히 "UI 테스트" / "임시 2일 기준"으로 표시한다.

## 구현
- `src/components/pack-reveal-modal.tsx`
  - `VelocitySummaryInline` compact row를 제거하고 `VelocityBasisMini` 큰 카드로 교체.
  - `LiquidityCurveMini` import와 상세 렌더링을 제거.
  - 상단 흐름을 `시세 → 판매속도 강조 카드 → 왜 이걸 추천했나요?` 순서로 고정.

## 보류
- `src/components/liquidity-curve-mini.tsx` 자체는 삭제하지 않았다. 다른 화면에서 재사용 가능성이 있고, 현재 상세 화면에서만 제거했다.
- 실제 판매속도 산출/DB 로직은 변경하지 않았다.

## 검증
- `npx eslint src/components/pack-reveal-modal.tsx`
- `npm run build`
