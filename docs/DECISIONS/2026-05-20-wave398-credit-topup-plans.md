# 2026-05-20 Wave 398 — 크레딧 충전권 가격표 및 plans 페이지 개편

## 결정

- `/plans`를 구독 요금제 비교가 아니라 크레딧 충전권 선택 화면으로 재구성했다.
- 공통 패키지 정의(`src/lib/plan-config.ts`)를 새 충전 가격표로 변경했다.
  - 3,900원 → 20크레딧
  - 19,900원 → 200크레딧
  - 39,900원 → 500크레딧
- 기존 결제 RPC가 `plan.monthlyCredits` 값을 받아 크레딧을 지급하므로, UI/API 공통 SoT를 바꿔 실제 grant 값도 새 가격표를 따르게 했다.
- 단건 충전 톤을 유지하기 위해 `/plans`에서 패키지 취소/재활성화 CTA를 제거하고, 최근 충전 상품 및 보유 크레딧 확인 CTA 중심으로 바꿨다.
- `/billing/checkout` 결제 요약도 `충전권`, `충전 크레딧`, `보유 잔액에 즉시 더해짐` 표현으로 맞췄다.

## 보류

- 내부 DB/API 명칭에는 아직 `plan`, `monthlyCredits`, `current_period_end` 같은 구독형 흔적이 남아 있다. 실제 schema/API 명칭 정리는 결제 시스템 안정화 후 별도 migration/API refactor로 진행한다.
- 크레딧 사용기한, 상세 환불 산식, 충전권별 부가 기능 노출 범위는 최종 PG/운영 정책 확정 후 약관/환불정책과 같이 한 번 더 정리한다.
- 실제 PG 결제창 연동은 아직 mock checkout 흐름이므로 후속 작업으로 남긴다.

## 검증

- `tests/credit-package-config.test.ts`를 추가해 새 가격/크레딧 grant 값이 유지되도록 했다.
- `npx tsx --test tests/credit-package-config.test.ts` 통과.
- `npm run lint -- src/app/plans/page.tsx src/app/billing/checkout/checkout-client.tsx src/lib/plan-config.ts tests/credit-package-config.test.ts` 통과.
- 기존 dev server(`localhost:3000`)에서 `/plans`와 `/billing/checkout?plan=plus`를 브라우저로 확인했다.
