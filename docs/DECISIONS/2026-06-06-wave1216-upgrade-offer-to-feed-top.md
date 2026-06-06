# Wave 1216 — 1시간 특가 업그레이드 오퍼를 피드 상단으로 (owner)

날짜: 2026-06-06
관련: explore-client.tsx, FeedMembershipUpsellCard
owner: "70,000원 1년 업그레이드 오퍼가 왜 맨 밑으로 간 거야? 맨 위도 아니고"

## 문제
`FeedMembershipUpsellCard`(1시간 특가 7만원 등 연장 업그레이드 오퍼)가 explore-client 조건 체인
(skeleton/empty/매물 grid) **뒤** 독립 블록(구 5152)에서 렌더 → 피드 매물을 다 스크롤해야 보이는 맨 밑.
강력한 FOMO 오퍼인데 노출이 사실상 0.

## fix
오퍼 블록을 조건 체인 **직전**(4511 "로딩/에러/매물 grid" 주석 위)으로 이동.
- `shouldShowFeedUpsell` 조건 그대로 → 매물 있을 때만, 로딩 중엔 숨김(변동 없음).
- 매물 grid 위(통계·필터 헤더 다음)에 떠서 눈에 띔. mt-4→mb-4(아래 매물과 간격).
- 기존 하단 블록 제거(중복 방지).

## TS check
clean.
