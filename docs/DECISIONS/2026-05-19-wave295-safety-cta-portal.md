# 2026-05-19 Wave 295 — fixed 안전 확인 dialog portal 처리

## 배경
- Wave 294에서 `/me` 상세 하단 fixed footer 왼쪽에 `안전 확인` CTA를 추가했다.
- 실제 클릭 시 화면은 블러 처리되지만 위험 신호 dialog가 보이지 않는 문제가 있었다.
- 원인은 footer 내부에 `RiskScoreBar` dialog를 렌더링하면서 상세 모달의 fixed/overflow/stacking 컨텍스트와 충돌한 것으로 판단했다.

## 결정
- footer CTA에서 여는 위험 신호 dialog는 `document.body`로 portal 렌더링한다.
- `RiskScoreBar`에 `portalDetail` 옵션을 추가하고, footer의 `안전 확인` CTA에서만 사용한다.
- portal 모드에서는 backdrop/dialog z-index를 `190/200`으로 올려 상세 모달 및 하단 fixed footer보다 확실히 위에 뜨게 한다.
- 본문 안 안전 패널과 admin 등 기존 inline 사용처는 기존 위치 규칙을 유지한다.

## 보류
- 모든 보조 dialog를 portal 기반 공통 컴포넌트로 통합하는 작업은 보류한다. 현재 긴급 문제는 footer CTA 한정이다.
- 실제 로그인 세션 기반 시각 QA 자동화는 별도 준비가 필요해 보류한다.

## 검증
- 계약 테스트에서 footer 안전 CTA가 `portalDetail`을 사용하고, `RiskScoreBar`가 `createPortal(document.body)` 경로를 갖는지 확인한다.
- `npm run build`로 Next typecheck를 확인한다.
