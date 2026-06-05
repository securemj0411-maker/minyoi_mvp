# Wave 1165 — 송금 UI 브랜드 로고 적용

- 결정: 사용자가 제공한 Toss/Kbank PNG를 public용으로 리사이즈해 `public/payment/` 아래에 추가했다.
- 결정: `TossPaymentLogo`, `KbankPaymentLogo` 공통 컴포넌트를 만들고 Next Image로 렌더링한다.
- 결정: 멤버십 입금 모달과 피드 업셀 입금 카드에 Toss/Kbank 로고를 넣어 `토스로 송금하기`와 `계좌로 직접 송금하기`가 결제 옵션처럼 보이도록 개선했다.
- 검증:
  - `git diff --check` 통과.
  - `npm run lint` 에러 0개(기존 warning 유지).
  - `npm run build` 성공.
- 보류:
  - 현재 세션에 브라우저 자동화 도구가 노출되지 않아 운영자 로그인 상태에서의 실제 결제 모달 시각 검증은 배포 후 확인한다.
