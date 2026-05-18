# Wave 298 — 판매속도와 추천 이유를 시세 바로 아래로 이동

## 배경
- `/me` 상품 상세에서 "비슷한 상품은 보통 N일 안에 팔려요"가 시장 분석/그래프 영역 안에 있어 사용자가 핵심 정보로 바로 인식하기 어려웠다.
- 사용자는 시세를 확인하는 순간 바로 판매 속도와 "왜 이걸 추천했나요?" 근거를 이어서 보고 싶다고 요청했다.

## 결정
- 상품 상세 상단 카드의 `매입 · 시세` 줄 바로 아래에 판매속도 한 줄 요약을 배치한다.
- "왜 이걸 추천했나요?" 패널도 같은 상단 카드 안으로 옮겨, 시세 → 판매속도 → 추천 이유 순서로 읽히게 한다.
- 기존 시장 분석 카드 안의 별도 판매속도 큰 박스는 제거해 중복 노출을 줄인다.
- 가격대별 판매속도 곡선은 그래프 영역에 남긴다. 이는 판매속도 요약과 역할이 다르며, 가격을 올리거나 내렸을 때 속도가 어떻게 달라지는지 확인하는 보조 정보다.

## 구현
- `src/components/pack-reveal-modal.tsx`
  - `saleSpeedDisplay` helper를 추가해 실제 velocity와 2일 UI fallback을 공통 처리.
  - `VelocitySummaryInline`을 추가해 상단 가격 정보 바로 아래에 compact 판매속도 row를 표시.
  - `RecommendationReasonPanel`을 상단 카드 내부로 이동.
  - 시장 분석 카드의 `VelocityBasisMini` 노출은 제거.

## 보류
- 판매속도 fallback은 여전히 UI 검수용이다. 실제 추천 점수/DB 계산에는 반영하지 않는다.
- `/me` 목록 카드에는 판매속도를 올리지 않았다. 목록에서 모든 매물의 velocity를 가져오면 비용/지연이 커질 수 있어 상세 lazy-load 원칙을 유지한다.

## 검증
- `npx eslint src/components/pack-reveal-modal.tsx src/components/liquidity-curve-mini.tsx src/lib/liquidity-curve.ts`
- `npm run build`
- `http://127.0.0.1:3000/me` dev 서버 접속 확인. 로그인 세션이 없는 브라우저라 상세 모달 실데이터까지는 확인하지 못했다.
