# 2026-05-22 Wave 528 — 상세보기 원본 이동 CTA 로고 source-aware 처리

## 결정
- 상세보기 하단 고정 CTA의 왼쪽 로고를 매물 source에 따라 바꾸도록 했다.
- 기존에는 중고나라/번개장터 모두 같은 고정 문자 아이콘처럼 보여 source 신뢰감이 떨어졌다.
- `marketplaceSafetyForCard(card)`의 source 판정에 맞춰 중고나라는 `JoongnaLogo`, 번개장터는 `BunjangLogo`를 렌더링한다.

## 보류
- 비교 매물 리스트의 `원문 보기` 작은 링크에는 현재 텍스트만 유지한다. 필요하면 다음 wave에서 source badge를 붙인다.

## 검증
- `npm run build`
