# 2026-06-04 Wave 1044 — membership plan selection and pending state

## Trigger

멤버십 신청 후 새로고침하면 `/plans`에서 다시 `신청하기`가 떠서, 이미 신청한 상태가 기기/브라우저를 넘어 유지되지 않았다.

추가로 신청 단계에서 1/3/6/12개월 기간 선택, 월 단가 할인, 짧은 기간 선택자 대상 업셀 모달을 실험하기로 했다.

## Decisions

- 신청 상태는 localStorage가 아니라 DB의 `mvp_membership_applications` pending row를 source of truth로 둔다.
- 별도 사용자 테이블 칼럼은 만들지 않는다.
  - 신청/검토 상태: `mvp_membership_applications`
  - 승인 후 권한 상태: `mvp_user_plans`
- `/plans` 서버 컴포넌트가 로그인 사용자의 pending 신청을 조회해서 클라이언트에 내려준다.
- 기간별 상품은 기존 `product_key`/`price_krw`에 저장한다.
- 1개월 또는 3개월 선택자는 신청 전 업셀 모달을 본다.
  - 1개월 선택: 3/6/12개월 특별 조건 제안
  - 3개월 선택: 6/12개월 전환 조건 제안
- "10% 확률 당첨" 표현은 이번 구현에서 제외했다. 대신 `신청 직후 10분 조건`으로 표현한다.

## Applied

- `src/lib/membership-plans.ts`에 일반/업셀 상품 정의를 추가했다.
- `/plans`에 1/3/6/12개월 선택 카드를 추가했다.
- 신청 API가 `productKey`를 받아 `product_key`/`price_krw`를 저장하게 했다.
- pending 신청이 있으면 `/plans`가 `신청 접수 완료` 상태를 보여준다.
- cau 운영자 페이지의 신청 상품 표시를 고정 `3개월`에서 실제 plan label/monthly label로 변경했다.

## Deferred

- 결제 링크 생성/결제 금액 적용은 아직 없다. 현재는 승인 후 운영자가 결제 안내하는 구조다.
- 업셀 조건의 실제 만료 서버 검증은 아직 없다. 결제 자동화 시 서버 측 만료/가격 검증을 추가해야 한다.
