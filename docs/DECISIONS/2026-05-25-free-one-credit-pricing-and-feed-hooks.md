# 2026-05-25 — Free 1회 / 새 크레딧 가격 / 피드 회전 후크

## 결정

- 무료 상세보기는 기존 3회에서 **1회**로 줄인다.
- 피드 탐색은 계속 무료로 두고, 결제 지점은 상세 분석/원본 공개 1회 = 1크레딧으로 유지한다.
- 크레딧 패키지는 다음 구조로 바꾼다.
  - 1크레딧 690원
  - 5크레딧 2,900원
  - 20크레딧 9,900원
  - 45크레딧 19,900원
  - 130크레딧 49,900원
- paywall의 “무료 3건 동안 비교 매물 36건 / 판단 시간 45분 절약”은 실제 데이터가 아니라 `12건`, `15분` 하드코딩 누적이었으므로 제거한다.
- paywall summary는 실제로 열린 상세에서 계산 가능한 값만 보여준다.
  - 열어본 상세 수
  - 확인한 예상 수익 합
  - 주의 신호 수
- 피드에는 기존 시세/판매자 신호 외에 `mvp_market_velocity_daily` 기반 회전 속도 후크를 추가한다.
  - 예: “보통 3일 내 팔림”
  - velocity fetch 실패는 피드 장애로 만들지 않고 non-fatal 처리한다.

## 구현

- 정책 SoT: `src/lib/plan-config.ts`, `src/lib/detail-access.ts`
- 결제/충전 라우팅: `/plans`, `/billing/manual`, `/billing/checkout`, `/api/billing/subscribe`
- DB 호환 migration 추가:
  - `supabase/migrations/20260525000100_credit_package_keys.sql`
  - `mvp_user_plans.plan_key` check와 `subscribe_mvp_plan` 허용 plan key를 `single/trial/starter/plus/pro`로 확장
- 피드 API:
  - `/api/packs/pool`에서 최신 velocity row를 읽고 teaser item에 `velocitySignalLabel` 추가
- 프론트:
  - locked teaser 카드에 velocity chip 표시
  - paywall summary의 하드코딩 비교매물/판단시간 제거

## 보류

- 구독형 모델은 이번 wave에서 구현하지 않음.
- “카톡 공유 시 +2회” 같은 referral/free 확장 정책은 별도 결정 필요.
- Supabase production migration 적용은 배포/운영 절차에서 별도 확인 필요. 코드와 migration은 포함됨.

## 검증

- `npx tsx --test tests/credit-package-config.test.ts tests/free-plus-entitlement-contract.test.ts tests/pg-review-readiness.test.ts`
- `npm run build`
