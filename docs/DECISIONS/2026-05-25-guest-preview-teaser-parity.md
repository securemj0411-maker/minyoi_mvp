# 2026-05-25 Guest Preview Teaser Parity

## Context

- 비회원 메인 페이지가 `/me` locked feed 와 다른 legacy preview 경로를 사용했다.
- 그 결과 sold 표본을 쓰는 public preview 에서 "최근 거래된 실제 매물", "거래 완료", 원본 제목, 정확 매입가/시세/수익, 거래 완료 시간이 노출됐다.
- 현재 BM 방향은 feed 에서 욕망을 만들되 식별/실행 정보는 상세 보기로 묶는 것이다. public preview 도 같은 teaser 정책이어야 한다.

## Decision

- `/api/preview-pool` public response 에서 원본 제목, 원본 thumbnail URL, sold 시각, 정확 매입가/시세/수익을 내려주지 않는다.
- public response 는 `previewTitle`, `profitLabel`, `budgetLabel`, `priceSignalLabel`, 서버 블러 이미지, condition/seller/market proof chip 만 제공한다.
- SSR preview 와 client fallback preview 모두 `/me` locked feed 와 같은 문법을 쓴다:
  - "필요 예산"
  - "정확 시세 잠김"
  - "상세에서 원문 공개"
  - "로그인하면 지금 진행 중인 추천 매물..."
- "거래 완료"와 빨간 sold 문구는 비회원 화면에서 제거한다.

## Deferred

- public preview 표본 자체를 sold 기반에서 active-safe synthetic teaser pool 로 바꾸는 것은 별도 wave 로 남긴다.
- 충전 페이지 가격 정책 개편은 다음 wave 에서 진행한다.
